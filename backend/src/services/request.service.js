// src/services/request.service.js
//
// Changes from previous version:
//   • requestInclude: added new FundRequest fields (approvedByName, rejectedByName,
//     rejectionSource, bypassedToFinance, requesterLevel) so every response
//     carries the display-ready approval/rejection identity (Req 6+7).
//   • approvalSteps include: added isEligible + ineligibleReason so the frontend
//     can distinguish eligible vs. audit-only steps.
//   • checkAccess: manager access now checks isEligible=true to mirror the
//     "ineligible managers never see the request" rule (Req 3).
//   • getRequestById: same isEligible guard in the access check.
//   • updateRequest: Enforces strict Amount Edit boundaries for submitted requests.
//     Throws an error if the edited amount falls outside the current highest approver's range.
//   • getEditLimits: New service function to return exact min/max bounds to the frontend.
//   • cancelRequest: PENDING step deletion now filters isEligible=true so
//     INELIGIBLE audit steps are preserved.

'use strict';

const prisma             = require('../config/db');
const { generateRequestNumber } = require('../utils/requestNumber.util');
const workflowService    = require('./workflow.service');

// ─── CORE INCLUDE ─────────────────────────────────────────────────────────────
// Used for full request detail responses.
// Includes all new schema fields needed by the UI.

const requestInclude = {
  createdBy: {
    select: {
      id: true, name: true, email: true, role: true,
      approvalLimit: true, hierarchyLevel: true, departmentId: true,
      department: { select: { id: true, name: true, code: true } },
    },
  },
  approvalSteps: {
    include: {
      approver: { select: { id: true, name: true, email: true } },
    },
    // NEW: isEligible + ineligibleReason included automatically via approver select;
    // the step fields themselves (isEligible, ineligibleReason, approvalLimitAtTime)
    // are returned because Prisma returns all scalar fields by default.
    orderBy: [{ cycle: 'asc' }, { level: 'asc' }],
  },
  financeReviews: {
    include: {
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { reviewedAt: 'desc' },
  },
  attachments: {
    where:   { isDeleted: false },
    orderBy: { createdAt: 'asc' },
  },
  _count: {
    select: { attachments: true },
  },
};

// ─── SAFE HISTORY FETCH ───────────────────────────────────────────────────────

const safeGetHistory = async (fundRequestId) => {
  try {
    const history = await prisma.workflowHistory.findMany({
      where:   { fundRequestId },
      orderBy: { createdAt: 'asc' },
    });
    if (!history.length) return [];

    const actorIds = [...new Set(history.map(h => h.actorId).filter(Boolean))];
    let actorMap   = {};
    if (actorIds.length > 0) {
      const actors = await prisma.user.findMany({
        where:  { id: { in: actorIds } },
        select: { id: true, name: true, role: true },
      });
      actorMap = Object.fromEntries(actors.map(a => [a.id, a]));
    }

    return history.map(h => ({
      id:            h.id,
      fundRequestId: h.fundRequestId,
      actorId:       h.actorId,
      actorRole:     h.actorRole,
      action:        h.action,
      fromStatus:    h.fromStatus,
      toStatus:      h.toStatus,
      remarks:       h.remarks,
      approvalCycle: h.approvalCycle,
      metadata:      h.metadata,
      createdAt:     h.createdAt,
      actor:         h.actorId ? (actorMap[h.actorId] || null) : null,
    }));
  } catch (e) {
    console.error('safeGetHistory error (non-fatal):', e.message);
    return [];
  }
};

// ─── ACCESS CONTROL ───────────────────────────────────────────────────────────

const checkAccess = async (request, userId, userRole) => {
  if (userRole === 'USER') {
    if (request.createdById !== userId)
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    return;
  }

  if (userRole === 'MANAGER') {
    const step = await prisma.approvalStep.findFirst({
      where: {
        fundRequestId: request.id,
        approverId:    userId,
        isEligible:    true,
        OR: [
          { cycle: request.approvalCycle },
          { status: { in: ['APPROVED', 'REJECTED'] } },
        ],
      },
    });
    if (!step)
      throw Object.assign(
        new Error("Access denied — not in this request's approval chain"),
        { statusCode: 403 },
      );
    return;
  }

  if (userRole === 'FINANCE') {
    const allowed = [
      'PENDING_FINANCE_APPROVAL', 'FINANCE_APPROVED',
      'FINANCE_REJECTED', 'NEEDS_REVIEW',
    ];
    if (!allowed.includes(request.status))
      throw Object.assign(
        new Error('Access denied — request not at finance stage'),
        { statusCode: 403 },
      );
    return;
  }
};

// ─── GET REQUEST BY ID ────────────────────────────────────────────────────────

const getRequestById = async (requestId, userId, role) => {
  const id = parseInt(requestId);
  if (isNaN(id)) throw Object.assign(new Error('Invalid request ID'), { statusCode: 400 });

  const request = await prisma.fundRequest.findUnique({
    where:   { id, isDeleted: false },
    include: requestInclude,
  });

  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });

  const isCreator  = request.createdById === userId;
  const isApprover = role === 'MANAGER' &&
    request.approvalSteps?.some(s =>
      s.approverId === userId &&
      s.isEligible &&
      (s.cycle === request.approvalCycle || ['APPROVED', 'REJECTED'].includes(s.status))
    );
  const isFinance  = role === 'FINANCE';

  if (!isCreator && !isApprover && !isFinance) {
    throw Object.assign(
      new Error("Access denied — not in this request's approval chain"),
      { statusCode: 403 },
    );
  }

  const workflowHistory = await safeGetHistory(id);
  return { ...request, workflowHistory };
};

// ─── GET EDIT LIMITS (NEW) ─────────────────────────────────────────────────────
// Calculates the strict min/max boundaries for the active chain.

// ─── GET EDIT LIMITS (UPDATED) ────────────────────────────────────────────────
// Calculates boundaries based on the current active approval chain for the request.

const getEditLimits = async (requestId, userId) => {
  const rid = parseInt(requestId);
  if (isNaN(rid)) throw Object.assign(new Error('Invalid request ID'), { statusCode: 400 });

  const request = await prisma.fundRequest.findUnique({
    where:   { id: rid, isDeleted: false },
    include: {
      createdBy: { select: { id: true, approvalLimit: true, approvalHierarchyId: true, hierarchyLevel: true } },
      approvalSteps: {
        where:   { isEligible: true },
        include: { approver: { select: { id: true, name: true, approvalLimit: true } } },
        orderBy: { level: 'asc' },
      },
    },
  });

  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (request.createdById !== userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });

  const creator     = request.createdBy;
  const userLimit   = parseFloat(creator.approvalLimit) || 0;
  const isDraftLike = ['DRAFT', 'NEEDS_REVIEW'].includes(request.status);

  // 1. DRAFT logic: Use global hierarchy max
  if (isDraftLike) {
    let maxApprovableLimit = userLimit;
    if (creator.approvalHierarchyId) {
      const allSteps = await prisma.hierarchyStep.findMany({ where: { hierarchyId: creator.approvalHierarchyId } });
      const higher = allSteps.filter(s => s.level > (creator.hierarchyLevel ?? 0));
      if (higher.length > 0) maxApprovableLimit = Math.max(...higher.map(s => parseFloat(s.approvalLimitSnapshot) || 0));
    }
    return { isDraft: true, minAmount: 0, maxAmount: maxApprovableLimit, approvalLimit: userLimit, maxApprovableLimit };
  }

  // 2. SUBMITTED logic: Filter steps by the CURRENT active cycle
  const currentSteps = (request.approvalSteps || [])
    .filter(s => s.cycle === request.approvalCycle)
    .sort((a, b) => a.level - b.level);

  // If no steps, it bypassed to finance (user limit applies)
  if (currentSteps.length === 0) {
    return { isDraft: false, minAmount: 0, maxAmount: userLimit, approvalLimit: userLimit };
  }

  // Find the manager required for the CURRENT saved amount
  const currentAmount = parseFloat(request.amount);
  const targetIdx = currentSteps.findIndex(s => parseFloat(s.approvalLimitAtTime) >= currentAmount);
  
  // If request amount is already higher than all managers, use the top manager
  const targetStep = targetIdx !== -1 ? currentSteps[targetIdx] : currentSteps[currentSteps.length - 1];
  
  const maxAmount = parseFloat(targetStep.approvalLimitAtTime) || 0;
  
  // Floor is the previous manager's limit + 1
  const minAmount = (targetIdx > 0) 
    ? (parseFloat(currentSteps[targetIdx - 1].approvalLimitAtTime) || 0) + 1 
    : userLimit + 1;

  return {
    isDraft: false,
    minAmount,
    maxAmount,
    approvalLimit: userLimit,
    highestApproverName: targetStep.approver?.name || `Manager ${targetStep.level}`,
    highestApproverLimit: maxAmount
  };
};
// ─── CREATE REQUEST (DRAFT) ───────────────────────────────────────────────────

const createRequest = async (userId, data, files = []) => {
  const creator = await prisma.user.findUnique({
    where:  { id: userId },
    select: { department: { select: { code: true } } },
  });
  if (!creator)
    throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const deptCode = creator.department?.code;
  if (!deptCode)
    throw Object.assign(new Error('User has no department assigned'), { statusCode: 400 });

  const request = await prisma.$transaction(async (tx) => {
    const requestNumber = await generateRequestNumber(tx, deptCode);

    return tx.fundRequest.create({
      data: {
        requestNumber,
        title:       data.title,
        description: data.description,
        amount:      parseFloat(data.amount),
        purpose:     data.purpose   || null,
        startDate:   data.startDate ? new Date(data.startDate) : null,
        endDate:     data.endDate   ? new Date(data.endDate)   : null,
        status:      'DRAFT',
        createdById: userId,
        attachments: files.length > 0 ? {
          create: files.map(f => ({
            fileName:     f.filename,
            originalName: f.originalname,
            fileType:     f.mimetype,
            fileSize:     f.size,
            filePath:     f.path,
          })),
        } : undefined,
      },
      include: requestInclude,
    });
  });

  return { ...request, workflowHistory: [] };
};

// ─── UPDATE REQUEST ────────────────────────────────────────────────────────────

const updateRequest = async (requestId, userId, data, files = []) => {
  const rid     = parseInt(requestId);
  
  // Use requestInclude to ensure we load createdBy and approvalSteps for boundary checks
  const request = await prisma.fundRequest.findUnique({
    where:   { id: rid },
    include: requestInclude,
  });

  if (!request)
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (request.createdById !== userId)
    throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
  if (request.isRejectedPermanently)
    throw Object.assign(
      new Error('Rejected requests cannot be edited or resubmitted.'),
      { statusCode: 400 },
    );

  const alwaysEditable = ['DRAFT', 'NEEDS_REVIEW'].includes(request.status);
  const conditionallyEditable =
    (request.status === 'PENDING_MANAGER_APPROVAL' && !request.viewedByManagerAt) ||
    (request.status === 'PENDING_FINANCE_APPROVAL' && !request.viewedByFinanceAt);

  if (!alwaysEditable && !conditionallyEditable)
    throw Object.assign(
      new Error('Request cannot be edited — it has been viewed by an approver.'),
      { statusCode: 400 },
    );

  const originalAmount = parseFloat(request.amount);
  const newAmount      = data.amount !== undefined ? parseFloat(data.amount) : originalAmount;
  const amountChanged  = Math.abs(newAmount - originalAmount) > 0.001;
  const activeStatuses = ['SUBMITTED', 'PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL'];

  // ─── STRICT RANGE VALIDATION BEFORE UPDATE ───
  // ─── STRICT RANGE VALIDATION BEFORE UPDATE ───
  if (amountChanged && activeStatuses.includes(request.status)) {
    const userLimit = request.createdBy?.approvalLimit || 0;
    let minAmount = 1;
    let maxAmount = userLimit;
    let highestLevel = 0;

    if (originalAmount > userLimit && request.createdBy?.approvalHierarchyId) {
      // Fetch hierarchy to establish boundaries based on the ORIGINAL amount
      const hierarchySteps = await prisma.hierarchyStep.findMany({
        where:  { hierarchyId: request.createdBy.approvalHierarchyId },
        orderBy: { approvalLimitSnapshot: 'asc' }
      });

      if (hierarchySteps.length > 0) {
        let reqIdx = hierarchySteps.findIndex(s => parseFloat(s.approvalLimitSnapshot) >= originalAmount);
        if (reqIdx === -1) reqIdx = hierarchySteps.length - 1;
        
        const highestStep = hierarchySteps[reqIdx];
        maxAmount = parseFloat(highestStep.approvalLimitSnapshot) || 0;
        highestLevel = highestStep.level;

        minAmount = (reqIdx > 0)
          ? (parseFloat(hierarchySteps[reqIdx - 1].approvalLimitSnapshot) || 0) + 1
          : userLimit + 1;
      }
    }

    if (newAmount > maxAmount) {
      const msg = highestLevel > 0
        ? `The amount cannot exceed Manager ${highestLevel}'s approval limit of ₹${maxAmount}. Please enter an amount within the allowed range.`
        : `The amount cannot exceed your personal approval limit of ₹${maxAmount} as this request bypassed managers.`;
      throw Object.assign(new Error(msg), { statusCode: 400 });
    }

    if (newAmount < minAmount && originalAmount > userLimit) {
      throw Object.assign(
        new Error(`The amount cannot be reduced below ₹${minAmount} without altering the approval chain. Please create a new request.`),
        { statusCode: 400 }
      );
    }
  }
  // ─── EXECUTE UPDATE ───
  const updated = await prisma.fundRequest.update({
    where: { id: rid },
    data:  {
      title:         data.title       !== undefined ? data.title       : request.title,
      description:   data.description !== undefined ? data.description : request.description,
      amount:        newAmount,
      purpose:       data.purpose     !== undefined ? (data.purpose   || null) : request.purpose,
      startDate:     data.startDate   !== undefined ? (data.startDate ? new Date(data.startDate) : null) : request.startDate,
      endDate:       data.endDate     !== undefined ? (data.endDate   ? new Date(data.endDate)   : null) : request.endDate,
      isModified:    true,
      modifiedAt:    new Date(),
      modifiedCount: { increment: 1 },
      attachments: files.length > 0 ? {
        create: files.map(f => ({
          fileName:     f.filename,
          originalName: f.originalname,
          fileType:     f.mimetype,
          fileSize:     f.size,
          filePath:     f.path,
        })),
      } : undefined,
    },
    include: requestInclude,
  });

  // Recalculate routing if amount changed and within bounds
  if (amountChanged && activeStatuses.includes(request.status)) {
    await workflowService.recalculateWorkflow(rid, userId);
  }

  const workflowHistory = await safeGetHistory(rid);
  return { ...updated, workflowHistory };
};

// ─── GET MY REQUESTS ──────────────────────────────────────────────────────────

const getMyRequests = async (userId, page = 1, limit = 10, status, search) => {
  const IN_PROGRESS = [
    'SUBMITTED', 'PENDING_MANAGER_APPROVAL', 'MANAGER_APPROVED',
    'PENDING_FINANCE_APPROVAL', 'RESUBMITTED',
  ];
  const ALL_REJECTED = ['REJECTED', 'FINANCE_REJECTED', 'NEEDS_REVIEW'];

  const where = { createdById: userId, isDeleted: false };

  if (status === 'INPROGRESS') {
    where.status = { in: IN_PROGRESS };
  } else if (status === 'REJECTED') {
    where.status = { in: ALL_REJECTED };
  } else if (status) {
    where.status = status;
  }

  if (search?.trim()) {
    where.OR = [
      { title:         { contains: search.trim() } },
      { requestNumber: { contains: search.trim() } },
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.fundRequest.findMany({
      where,
      include: {
        approvalSteps: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: [{ cycle: 'asc' }, { level: 'asc' }],
        },
        financeReviews: { orderBy: { reviewedAt: 'desc' }, take: 1 },
        _count:         { select: { attachments: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip:    (page - 1) * Number(limit),
      take:    Number(limit),
    }),
    prisma.fundRequest.count({ where }),
  ]);

  return { requests, total };
};

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

const getDashboardStats = async (userId) => {
  const base = { createdById: userId, isDeleted: false };
  const inProgressSts = [
    'SUBMITTED', 'PENDING_MANAGER_APPROVAL', 'MANAGER_APPROVED',
    'PENDING_FINANCE_APPROVAL', 'RESUBMITTED',
  ];
  const allRejectedSts = ['REJECTED', 'FINANCE_REJECTED', 'NEEDS_REVIEW'];

  const [
    total, inProgress, approved,
    rejected, cancelled, draft, recent,
  ] = await Promise.all([
    prisma.fundRequest.count({ where: base }),
    prisma.fundRequest.count({ where: { ...base, status: { in: inProgressSts } } }),
    prisma.fundRequest.count({ where: { ...base, status: 'FINANCE_APPROVED' } }),
    prisma.fundRequest.count({ where: { ...base, status: { in: allRejectedSts } } }),
    prisma.fundRequest.count({ where: { ...base, status: 'CANCELLED' } }),
    prisma.fundRequest.count({ where: { ...base, status: 'DRAFT' } }),
    prisma.fundRequest.findMany({
      where:   base,
      orderBy: { updatedAt: 'desc' },
      take:    5,
      include: {
        approvalSteps: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: [{ cycle: 'asc' }, { level: 'asc' }],
        },
      },
    }),
  ]);

  return {
    total, inProgress, approved,
    rejected,
    cancelled, draft, recent,
    rejectedByFinance: 0,
    needsReview:       0,
  };
};

// ─── CANCEL REQUEST ───────────────────────────────────────────────────────────

const cancelRequest = async (requestId, userId) => {
  const rid     = parseInt(requestId);
  const request = await prisma.fundRequest.findUnique({ where: { id: rid } });

  if (!request)
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (request.createdById !== userId)
    throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
  if (request.isRejectedPermanently)
    throw Object.assign(new Error('Rejected requests cannot be cancelled.'), { statusCode: 400 });

  const alwaysCancelable = ['DRAFT', 'NEEDS_REVIEW'].includes(request.status);
  const conditionallyCancelable =
    ['SUBMITTED', 'PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL'].includes(request.status) &&
    !request.viewedByManagerAt &&
    !request.viewedByFinanceAt;

  if (!alwaysCancelable && !conditionallyCancelable)
    throw Object.assign(
      new Error('Request cannot be cancelled — it has already been viewed by an approver.'),
      { statusCode: 400 },
    );

  return prisma.$transaction(async (tx) => {
    const updated = await tx.fundRequest.update({
      where: { id: rid },
      data:  { status: 'CANCELLED' },
    });

    if (conditionallyCancelable) {
      await tx.approvalStep.deleteMany({
        where: {
          fundRequestId: rid,
          cycle:         request.approvalCycle,
          status:        'PENDING',
          isEligible:    true,
        },
      });

      await tx.workflowHistory.create({
        data: {
          fundRequestId: rid,
          actorId:       userId,
          actorRole:     'USER',
          action:        'CANCELLED',
          fromStatus:    request.status,
          toStatus:      'CANCELLED',
          remarks:       'User cancelled the request before it was reviewed',
          approvalCycle: request.approvalCycle ?? 1,
        },
      });
    }

    return updated;
  });
};

// ─── GET ATTACHMENTS ──────────────────────────────────────────────────────────

const getAttachments = async (requestId, userId, role) => {
  const rid = parseInt(requestId);
  if (isNaN(rid)) throw Object.assign(new Error('Invalid request ID'), { statusCode: 400 });

  const request = await prisma.fundRequest.findUnique({
    where:   { id: rid, isDeleted: false },
    include: {
      attachments:   { where: { isDeleted: false }, orderBy: { createdAt: 'asc' } },
      approvalSteps: { select: { approverId: true, isEligible: true } },
    },
  });

  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });

  const isCreator  = request.createdById === userId;
  const isApprover = role === 'MANAGER' &&
    request.approvalSteps.some(s => s.approverId === userId && s.isEligible);
  const isFinance  = role === 'FINANCE';

  if (!isCreator && !isApprover && !isFinance)
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });

  return request.attachments;
};

// ─── ADD ATTACHMENTS ──────────────────────────────────────────────────────────

const addAttachments = async (requestId, userId, files = []) => {
  if (!files.length)
    throw Object.assign(new Error('No files provided'), { statusCode: 400 });

  const rid     = parseInt(requestId);
  const request = await prisma.fundRequest.findUnique({
    where: { id: rid, isDeleted: false },
  });

  if (!request)
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (request.createdById !== userId)
    throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
  if (request.isRejectedPermanently)
    throw Object.assign(new Error('Rejected requests cannot be modified.'), { statusCode: 400 });

  const alwaysEditable = ['DRAFT', 'NEEDS_REVIEW'].includes(request.status);
  const conditionallyEditable =
    (request.status === 'PENDING_MANAGER_APPROVAL' && !request.viewedByManagerAt) ||
    (request.status === 'PENDING_FINANCE_APPROVAL' && !request.viewedByFinanceAt);

  if (!alwaysEditable && !conditionallyEditable)
    throw Object.assign(
      new Error('Attachments cannot be added — the request has already been viewed by an approver.'),
      { statusCode: 400 },
    );

  const [attachments] = await prisma.$transaction([
    prisma.attachment.createManyAndReturn({
      data: files.map(f => ({
        fundRequestId: rid,
        fileName:      f.filename,
        originalName:  f.originalname,
        fileType:      f.mimetype,
        fileSize:      f.size,
        filePath:      f.path,
      })),
    }),
    prisma.fundRequest.update({
      where: { id: rid },
      data:  { isModified: true, modifiedAt: new Date(), modifiedCount: { increment: 1 } },
    }),
  ]);

  return attachments;
};

// ─── DELETE ATTACHMENT ────────────────────────────────────────────────────────

const deleteAttachment = async (requestId, attachmentId, userId) => {
  const rid = parseInt(requestId);
  const aid = parseInt(attachmentId);

  if (isNaN(rid) || isNaN(aid))
    throw Object.assign(new Error('Invalid ID'), { statusCode: 400 });

  const request = await prisma.fundRequest.findUnique({
    where:   { id: rid, isDeleted: false },
    include: { attachments: { where: { id: aid } } },
  });

  if (!request)
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (request.createdById !== userId)
    throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });
  if (request.isRejectedPermanently)
    throw Object.assign(new Error('Rejected requests cannot be modified.'), { statusCode: 400 });

  const attachment = request.attachments[0];
  if (!attachment || attachment.isDeleted)
    throw Object.assign(new Error('Attachment not found'), { statusCode: 404 });

  const alwaysEditable = ['DRAFT', 'NEEDS_REVIEW'].includes(request.status);
  const conditionallyEditable =
    (request.status === 'PENDING_MANAGER_APPROVAL' && !request.viewedByManagerAt) ||
    (request.status === 'PENDING_FINANCE_APPROVAL' && !request.viewedByFinanceAt);

  if (!alwaysEditable && !conditionallyEditable)
    throw Object.assign(
      new Error('Attachments cannot be deleted — the request has already been viewed by an approver.'),
      { statusCode: 400 },
    );

  await prisma.$transaction([
    prisma.attachment.update({
      where: { id: aid },
      data:  { isDeleted: true },
    }),
    prisma.fundRequest.update({
      where: { id: rid },
      data:  { isModified: true, modifiedAt: new Date(), modifiedCount: { increment: 1 } },
    }),
  ]);

  return { deleted: true, attachmentId: aid };
};

// ─── MARK VIEWED ─────────────────────────────────────────────────────────────

const markViewed = async (requestId, userRole) => {
  const rid = parseInt(requestId);
  if (isNaN(rid)) return;

  const data = {};
  if (userRole === 'MANAGER') data.viewedByManagerAt = new Date();
  if (userRole === 'FINANCE')  data.viewedByFinanceAt = new Date();

  if (Object.keys(data).length > 0) {
    await prisma.fundRequest.update({ where: { id: rid }, data }).catch(() => {});
  }
};

module.exports = {
  createRequest,
  getMyRequests,
  getRequestById,
  updateRequest,
  cancelRequest,
  getDashboardStats,
  safeGetHistory,
  markViewed,
  checkAccess,
  getEditLimits,
  getWorkflowHistory: safeGetHistory,
  getAttachments,
  addAttachments,
  deleteAttachment,
};