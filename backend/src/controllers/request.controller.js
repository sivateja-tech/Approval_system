// src/controllers/request.controller.js
//
// Changes:
//   • getMyRequests: passes `search` query param through to service.
//   • validateSubmission: NEW endpoint — called by frontend before showing
//     Submit button. Returns { blocked, reason, maxApprovableLimit } (Req 9).
//   • getRequestEditLimits: Calculates exact dynamic floors/ceilings (Req: Amount Edit Rules)
//   • All other handlers unchanged.

const asyncHandler    = require('../middleware/async.middleware');
const requestService  = require('../services/request.service');
const workflowService = require('../services/workflow.service');
const { success }     = require('../utils/response.util');

exports.create = asyncHandler(async (req, res) => {
  const files   = req.files || [];
  const request = await requestService.createRequest(req.user.id, req.body, files);
  return success(res, request, 'Request created as draft', 201);
});

exports.getMyRequests = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const { requests, total } = await requestService.getMyRequests(
    req.user.id, Number(page), Number(limit), status, search || null,
  );
  return res.json({
    success: true,
    data: requests,
    pagination: {
      page:  Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

exports.getById = asyncHandler(async (req, res) => {
  const request = await requestService.getRequestById(
    req.params.id, req.user.id, req.user.role,
  );
  return success(res, request, 'Request details');
});

exports.update = asyncHandler(async (req, res) => {
  const files   = req.files || [];
  const request = await requestService.updateRequest(
    parseInt(req.params.id), req.user.id, req.body, files,
  );
  return success(res, request, 'Request updated');
});

exports.submit = asyncHandler(async (req, res) => {
  const result = await workflowService.submitRequest(
    parseInt(req.params.id), req.user.id,
  );
  return success(res, result, 'Request submitted successfully');
});

// GET /requests/:id/validate-submission
exports.validateSubmission = asyncHandler(async (req, res) => {
  const rid     = parseInt(req.params.id);
  const request = await require('../config/db').fundRequest.findUnique({
    where:   { id: rid },
    include: { createdBy: true },
  });
  if (!request)
    return res.status(404).json({ success: false, message: 'Request not found' });
  if (request.createdById !== req.user.id)
    return res.status(403).json({ success: false, message: 'Unauthorized' });

  const result = await workflowService.validateSubmission(request.createdBy, request.amount);
  return success(res, result, result.blocked ? 'Submission blocked' : 'Submission allowed');
});

exports.cancel = asyncHandler(async (req, res) => {
  const result = await requestService.cancelRequest(
    parseInt(req.params.id), req.user.id,
  );
  return success(res, result, 'Request cancelled');
});

exports.dashboard = asyncHandler(async (req, res) => {
  const stats = await requestService.getDashboardStats(req.user.id);
  return success(res, stats, 'Dashboard stats');
});

// GET /requests/my-limits
exports.getMyLimits = asyncHandler(async (req, res) => {
  const prisma = require('../config/db');

  const user = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: {
      approvalLimit:       true,
      approvalHierarchyId: true,
      hierarchyLevel:      true,
    },
  });

  if (!user)
    return res.status(404).json({ success: false, message: 'User not found' });

  let maxApprovableLimit = parseFloat(user.approvalLimit) || 0;

  if (user.approvalHierarchyId) {
    const steps = await prisma.hierarchyStep.findMany({
      where:   { hierarchyId: user.approvalHierarchyId },
      select:  { level: true, approvalLimitSnapshot: true },
    });

    let userLevel = user.hierarchyLevel;
    if (userLevel == null) {
      const ownStep = await prisma.hierarchyStep.findFirst({
        where:  { hierarchyId: user.approvalHierarchyId, approverId: req.user.id },
        select: { level: true },
      });
      userLevel = ownStep ? ownStep.level : 0;
    }
    userLevel = userLevel ?? 0;

    const higherSteps = steps.filter(s => s.level > userLevel);
    if (higherSteps.length > 0) {
      maxApprovableLimit = Math.max(
        ...higherSteps.map(s => parseFloat(s.approvalLimitSnapshot) || 0),
      );
    } else {
      maxApprovableLimit = parseFloat(user.approvalLimit) || 0;
    }
  }

  return success(res, {
    approvalLimit:      parseFloat(user.approvalLimit) || 0,
    maxApprovableLimit,
    hasHierarchy: !!user.approvalHierarchyId,
  }, 'User limits');
});

exports.markViewed = asyncHandler(async (req, res) => {
  await requestService.markViewed(parseInt(req.params.id), req.user.role);
  return success(res, null, 'Marked as viewed');
});

// GET /requests/:id/edit-limits
// Calculates exact edit range (minAmount, maxAmount) for Active Workflows
// GET /requests/:id/edit-limits
// Calculates exact edit range (minAmount, maxAmount)
// Fixed to properly handle Scenario 1 & 2 logic limits
exports.getRequestEditLimits = asyncHandler(async (req, res) => {
  const prisma  = require('../config/db');
  const rid     = parseInt(req.params.id);

  const request = await prisma.fundRequest.findUnique({
    where:   { id: rid },
    include: {
      createdBy: {
        select: {
          id: true, approvalLimit: true,
          approvalHierarchyId: true, hierarchyLevel: true,
        },
      },
      approvalSteps: {
        where:   { isEligible: true },
        include: { approver: { select: { id: true, name: true, approvalLimit: true } } },
        orderBy: { level: 'asc' },
      },
    },
  });

  if (!request)
    return res.status(404).json({ success: false, message: 'Request not found' });
  if (request.createdById !== req.user.id)
    return res.status(403).json({ success: false, message: 'Unauthorized' });

  const creator       = request.createdBy;
  const userLimit     = parseFloat(creator.approvalLimit) || 0;
  const isDraftLike   = ['DRAFT', 'NEEDS_REVIEW'].includes(request.status);
  const currentAmount = parseFloat(request.amount) || 0;

  let maxApprovableLimit = userLimit;
  let hasHierarchy       = !!creator.approvalHierarchyId;
  let hierarchySteps     = [];

  // ── Fetch the Full Hierarchy to establish absolute ceilings ──
  if (creator.approvalHierarchyId) {
    hierarchySteps = await prisma.hierarchyStep.findMany({
      where:  { hierarchyId: creator.approvalHierarchyId },
      include: { approver: { select: { name: true } } },
      orderBy: { level: 'asc' }
    });
    
    let userLevel = creator.hierarchyLevel;
    if (userLevel == null) {
      const own = hierarchySteps.find(s => s.approverId === creator.id);
      userLevel = own ? own.level : 0;
    }
    
    const higherSteps = hierarchySteps.filter(s => s.level > (userLevel ?? 0));
    if (higherSteps.length > 0) {
      maxApprovableLimit = Math.max(...higherSteps.map(s => parseFloat(s.approvalLimitSnapshot) || 0));
    }
  }

  if (isDraftLike) {
    return success(res, {
      isDraft:            true,
      minAmount:          0,
      maxAmount:          maxApprovableLimit,
      approvalLimit:      userLimit,
      maxApprovableLimit,
      hasHierarchy,
      currentChainMax:    maxApprovableLimit,
      currentChainMin:    0,
      chainDescription:   null,
    }, 'Edit limits for draft');
  }

  // ── PENDING_* (Submitted) Edit Range Logic ──
  // Rule: We must find the HIGHEST approver currently required by the SAVED amount.
  // The user can edit the amount up to that specific approver's limit.
  // The minimum amount is the tier immediately below the current saved tier.

  let minAmount = 0;
  let maxAmount = userLimit;
  let highestApproverName = 'your personal';
  let highestApproverLimit = userLimit;

  if (currentAmount <= userLimit) {
    // Current amount bypassed all managers
    minAmount = 1;
    maxAmount = userLimit;
  } else if (hierarchySteps.length > 0) {
    // Current amount requires at least one manager
    // Sort steps ascending to easily find the tiers
    const sortedSteps = [...hierarchySteps].sort((a, b) => parseFloat(a.approvalLimitSnapshot) - parseFloat(b.approvalLimitSnapshot));
    
    // Find the first manager whose limit covers the current amount
    let targetIdx = sortedSteps.findIndex(s => parseFloat(s.approvalLimitSnapshot) >= currentAmount);
    
    if (targetIdx === -1) {
      // Safety fallback: if amount somehow exceeds the highest known limit, lock it to the top manager
      targetIdx = sortedSteps.length - 1;
    }

    const targetStep = sortedSteps[targetIdx];
    maxAmount = parseFloat(targetStep.approvalLimitSnapshot) || 0;
    highestApproverName = targetStep.approver?.name || `Manager ${targetStep.level}`;
    highestApproverLimit = maxAmount;

    // The floor is the previous manager's limit + 1
    if (targetIdx > 0) {
      minAmount = (parseFloat(sortedSteps[targetIdx - 1].approvalLimitSnapshot) || 0) + 1;
    } else {
      // If target is Manager 1, the floor is the user's personal limit + 1
      minAmount = userLimit + 1;
    }
  }

  return success(res, {
    isDraft:              false,
    minAmount,
    maxAmount,
    approvalLimit:        userLimit,
    maxApprovableLimit,
    hasHierarchy,
    currentChainMax:      maxAmount,
    currentChainMin:      minAmount,
    chainDescription:     `${highestApproverName} (${fmt(maxAmount)})`,
    highestApproverName,
    highestApproverLimit,
  }, 'Edit limits');

  function fmt(n) {
    return `₹${Number(n).toLocaleString('en-IN')}`;
  }
});

// ─── ATTACHMENT HANDLERS ──────────────────────────────────────────────────────

exports.getAttachments = asyncHandler(async (req, res) => {
  const attachments = await requestService.getAttachments(
    req.params.id, req.user.id, req.user.role,
  );
  return success(res, attachments, 'Attachments fetched');
});

exports.addAttachments = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length)
    return res.status(400).json({ success: false, message: 'No files uploaded' });

  const attachments = await requestService.addAttachments(
    req.params.id, req.user.id, files,
  );
  return success(res, attachments, `${attachments.length} file(s) uploaded successfully`, 201);
});

exports.deleteAttachment = asyncHandler(async (req, res) => {
  const result = await requestService.deleteAttachment(
    req.params.id, req.params.attachmentId, req.user.id,
  );
  return success(res, result, 'Attachment deleted');
});