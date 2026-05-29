const prisma=require('../config/db');
const {generateRequestNumber}=require('../utils/requestNumber.util');
const workflowService=require('./workflow.service');
const requestInclude = {
  createdBy: {
    select: {
      id: true, name: true, email: true, role: true,
      approvalLimit: true, departmentId: true,
      department: { select: { id: true, name: true, code: true } },
    },
  },
  approvalSteps: {
    include: {
      approver: { select: { id: true, name: true, email: true } },
    },
    orderBy: { hodLevel: 'asc' },
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
    select: { comments: true, attachments: true },
  },
};
const safeGetHistory = async (fundRequestId) => {
  try {
    // Check if workflowHistory model exists first
    const history = await prisma.workflowHistory.findMany({
      where:   { fundRequestId },
      orderBy: { createdAt: 'asc' },
    });

    if (!history.length) return [];

    // Get actor IDs
    const actorIds = [...new Set(
      history.map(h => h.actorId).filter(id => id != null)
    )];

    // Fetch actors separately — safe
    let actorMap = {};
    if (actorIds.length > 0) {
      const actors = await prisma.user.findMany({
        where:  { id: { in: actorIds } },
        select: { id: true, name: true, role: true },
      });
      actorMap = Object.fromEntries(actors.map(a => [a.id, a]));
    }

    return history.map(h => ({
      id:           h.id,
      fundRequestId: h.fundRequestId,
      actorId:      h.actorId,
      actorRole:    h.actorRole,
      action:       h.action,
      fromStatus:   h.fromStatus,
      toStatus:     h.toStatus,
      remarks:      h.remarks,
      metadata:     h.metadata,
      createdAt:    h.createdAt,
      actor:        h.actorId ? (actorMap[h.actorId] || null) : null,
    }));
  } catch (e) {
    console.error('WorkflowHistory fetch error (non-fatal):', e.message);
    return [];  // NEVER crash the main request
  }
};
const createRequest = async (userId, data, files = []) => {
  const requestNumber = generateRequestNumber();
  if (
    (data.startDate && !data.endDate) ||
    (!data.startDate && data.endDate)
  ) {
    throw new Error(
      'Please provide both dates.'
    );
  }

  const request = await prisma.fundRequest.create({
    data: {
      requestNumber,
      title: data.title,
      description: data.description,
      amount: parseFloat(data.amount),
      purpose: data.purpose,
      
      startDate:   data.startDate   ? new Date(data.startDate)  : null,
      endDate:     data.endDate     ? new Date(data.endDate)    : null,
      fundUsed:    false,
      status: 'DRAFT',
      createdById: userId,
      attachments: files.length > 0 ? {
        create: files.map((f) => ({
          fileName: f.filename,
          originalName: f.originalname,
          fileType: f.mimetype,
          fileSize: f.size,
          filePath: f.path,
        })),
      } : undefined,
    },
    include: requestInclude,
  });

  return request;
};
const getMyRequests = async (userId, page = 1, limit = 10, status) => {
  const base = { createdById: userId, isDeleted: false };

  const IN_PROGRESS = [
    'SUBMITTED', 'PENDING_HOD_APPROVAL', 'HOD_APPROVED',
    'PENDING_FINANCE_APPROVAL', 'RESUBMITTED',
  ];

  const where = { ...base };
  if (status === 'INPROGRESS') {
    where.status = { in: IN_PROGRESS };
  } else if (status) {
    where.status = status; // exact match
  }

  const [requests, total] = await Promise.all([
    prisma.fundRequest.findMany({
      where,
      include: {
        approvalSteps: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: { hodLevel: 'asc' },
        },
        _count: { select: { attachments: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  Number(limit),
    }),
    prisma.fundRequest.count({ where }),
  ]);

  return { requests, total };
};
const getWorkflowHistory = async (fundRequestId) => {
  try {
    const history = await prisma.workflowHistory.findMany({
      where:   { fundRequestId },
      orderBy: { createdAt: 'asc' },
    });

    // Enrich with actor data separately
    const actorIds = [...new Set(history.map(h => h.actorId).filter(Boolean))];
    const actors   = actorIds.length
      ? await prisma.user.findMany({
          where:  { id: { in: actorIds } },
          select: { id: true, name: true, role: true },
        })
      : [];
    const actorMap = Object.fromEntries(actors.map(a => [a.id, a]));

    return history.map(h => ({
      ...h,
      actor: h.actorId ? (actorMap[h.actorId] || null) : null,
    }));
  } catch {
    return []; // never crash on timeline
  }
};
const getRequestById = async (requestId, userId, userRole) => {
  // Parse to int safely
  const id = parseInt(requestId);
  if (isNaN(id)) {
    const err = new Error('Invalid request ID');
    err.statusCode = 400;
    throw err;
  }

  const request = await prisma.fundRequest.findUnique({
    where:   { id, isDeleted: false },
    include: requestInclude,
  });

  if (!request) {
    const err = new Error('Request not found');
    err.statusCode = 404;
    throw err;
  }

  // ── Access control ────────────────────────────────────────────────────
  if (userRole === 'USER') {
    if (request.createdById !== userId) {
      const err = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }
  }

  if (userRole === 'HOD') {
    const myStep = request.approvalSteps?.find(s => s.approverId === userId);
    if (!myStep) {
      const err = new Error('Access denied — not assigned to this request');
      err.statusCode = 403;
      
      throw err;
    }
    if (myStep.status === 'WAITING') {
      const err = new Error('Access denied — not your turn yet');
      err.statusCode = 403;
      throw err;
    }
  }

  if (userRole === 'FINANCE') {
  const allowed = [
    'PENDING_FINANCE_APPROVAL',
    'FINANCE_APPROVED',
    'FINANCE_REJECTED',
    'NEEDS_REVIEW',  // ← Finance sent it back, they should still see it
  ];
  if (!allowed.includes(request.status)) {
    const err = new Error('Access denied — request not at finance stage');
    err.statusCode = 403;
    throw err;
  }
}

  // ── Fetch history safely ──────────────────────────────────────────────
  const workflowHistory = await safeGetHistory(id);

  return { ...request, workflowHistory };
};
// Replace updateRequest with full editability logic:
const updateRequest = async (requestId, userId, data, files = []) => {
  const request = await prisma.fundRequest.findUnique({ where: { id: requestId } });
  if (!request)                       throw new Error('Request not found');
  if (request.createdById !== userId) throw new Error('Unauthorized. Only the creator can edit.');

  // Editable if: DRAFT or NEEDS_REVIEW always
  // PENDING_HOD_APPROVAL — only if NOT yet viewed by HOD
  const alwaysEditable = ['DRAFT', 'NEEDS_REVIEW'];
  const conditionallyEditable = ['PENDING_HOD_APPROVAL', 'PENDING_FINANCE_APPROVAL'];

  if (alwaysEditable.includes(request.status)) {
    // always OK
  } else if (conditionallyEditable.includes(request.status)) {
    // Check if viewed
    if (request.status === 'PENDING_HOD_APPROVAL' && request.viewedByHODAt) {
      throw new Error('Request has been viewed by HOD and can no longer be edited.');
    }
    if (request.status === 'PENDING_FINANCE_APPROVAL' && request.viewedByFinanceAt) {
      throw new Error('Request has been viewed by Finance and can no longer be edited.');
    }
  } else {
    throw new Error('This request cannot be edited in its current status.');
  }
 
  const updatedRequest = await prisma.fundRequest.update({
    where: { id: requestId },
    data: {
      title:       data.title       || request.title,
      description: data.description || request.description,
      amount:      data.amount      ? parseFloat(data.amount) : request.amount,
      purpose:     data.purpose     !== undefined ? data.purpose  : request.purpose,
      startDate:   data.startDate   !== undefined
        ? (data.startDate ? new Date(data.startDate) : null) : request.startDate,
      endDate:     data.endDate     !== undefined
        ? (data.endDate   ? new Date(data.endDate)   : null) : request.endDate,
      ...(request.status!='DRAFT' && {
      isModified:    true,
      modifiedAt:    new Date(),
      modifiedCount: { increment: 1 },
      }),
    },
    include: requestInclude,
  
    
  });
  return updatedRequest;
};
  

const cancelRequest = async (requestId, userId) => {
  const request = await prisma.fundRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('Request not found');
  if (request.createdById !== userId) throw new Error('Unauthorized');
  if (!['DRAFT', 'NEEDS_REVIEW'].includes(request.status)) {
    throw new Error('Only DRAFT or NEEDS_REVIEW requests can be cancelled');
  }

  return prisma.fundRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED' },
  });
};

const getDashboardStats = async (userId) => {
  const base = { createdById: userId, isDeleted: false };
  const inProgressStatuses = [
    'SUBMITTED', 'PENDING_HOD_APPROVAL', 'HOD_APPROVED',
    'PENDING_FINANCE_APPROVAL', 'RESUBMITTED',
  ];

  const [total, inProgress, approved, rejectedByFinance, needsReview, draft, recent] =
    await Promise.all([
      prisma.fundRequest.count({ where: base }),
      prisma.fundRequest.count({ where: { ...base, status: { in: inProgressStatuses } } }),
      prisma.fundRequest.count({ where: { ...base, status: 'FINANCE_APPROVED' } }),
      prisma.fundRequest.count({ where: { ...base, status: 'FINANCE_REJECTED' } }),
      prisma.fundRequest.count({ where: { ...base, status: 'NEEDS_REVIEW' } }),
      prisma.fundRequest.count({ where: { ...base, status: 'DRAFT' } }),
      prisma.fundRequest.findMany({
        where:   base,
        orderBy: { updatedAt: 'desc' },
        take:    5,
        include: {
          approvalSteps: {
            include: { approver: { select: { id: true, name: true } } },
            orderBy: { hodLevel: 'asc' },
          },
        },
      }),
    ]);

  return { total, inProgress, approved, rejectedByFinance, needsReview, draft, recent };
};


module.exports = { createRequest, getMyRequests, getRequestById, updateRequest, cancelRequest, getDashboardStats };