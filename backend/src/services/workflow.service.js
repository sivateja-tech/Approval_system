

'use strict';

const prisma             = require('../config/db');
const notificationService = require('./notification.service');
const socketHandler      = require('../sockets/socket.handler');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ACTIONS = {
  SUBMITTED:              'SUBMITTED',
  BYPASSED_TO_FINANCE:    'BYPASSED_TO_FINANCE',
  RESUBMITTED:            'RESUBMITTED',
  MANAGER_APPROVED:       'MANAGER_APPROVED',
  MANAGER_REJECTED:       'MANAGER_REJECTED',
  //PEER_SKIPPED:           'PEER_SKIPPED',
  FINANCE_APPROVED:       'FINANCE_APPROVED',
  FINANCE_REJECTED:       'FINANCE_REJECTED',
  FINANCE_NEEDS_REVIEW:   'FINANCE_NEEDS_REVIEW',
  WORKFLOW_RECALCULATED:  'WORKFLOW_RECALCULATED',
};

// ─── SMALL HELPERS ────────────────────────────────────────────────────────────

const toFloat = (v) => parseFloat(v) || 0;

const fmt = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    maximumFractionDigits: 0,
  }).format(toFloat(amount));

// ─── NOTIFICATION HELPER ──────────────────────────────────────────────────────

const notify = async (userId, fundRequestId, type, title, message) => {
  try {
    const notif = await notificationService.createNotification({
      userId, fundRequestId, type, title, message,
    });
    socketHandler.notifyUser(userId, 'new_notification', notif);
  } catch (e) {
    console.error('Notify error (non-fatal):', e.message);
  }
};

// ─── HISTORY HELPER ───────────────────────────────────────────────────────────

const logHistory = (tx, params) => {
  const {
    fundRequestId, actorId, actorRole, action,
    fromStatus, toStatus, remarks, approvalCycle, metadata,
  } = params;
  return tx.workflowHistory.create({
    data: {
      fundRequestId,
      actorId,
      actorRole,
      action,
      fromStatus:    fromStatus    ?? null,
      toStatus:      toStatus      ?? null,
      remarks:       remarks       ?? null,
      approvalCycle: approvalCycle ?? 1,
      metadata:      metadata      ?? null,
    },
  });
};
const classifySteps = (allSteps, creatorLevel, requestAmount) => {
  const eligible   = [];
  const ineligible = [];

  for (const step of allSteps) {
    // Never include the creator's own step (they cannot approve their own request)
    if (step.level <= creatorLevel) {
      ineligible.push({ ...step, ineligibleReason: 'LEVEL_TOO_LOW' });
      continue;
    }
    if (toFloat(step.approvalLimitSnapshot) < toFloat(requestAmount)) {
      ineligible.push({ ...step, ineligibleReason: 'LIMIT_TOO_LOW' });
      continue;
    }
    eligible.push(step);
  }

  return { eligible, ineligible };
};
const loadHierarchySteps = async (approvalHierarchyId) => {
  if (!approvalHierarchyId) return [];
  return prisma.hierarchyStep.findMany({
    where:   { hierarchyId: approvalHierarchyId },
    include: { approver: { select: { id: true, name: true, approvalLimit: true } } },
    orderBy: { level: 'asc' },
  });
};
const validateSubmission = async (creator, requestAmount) => {
  const amount = toFloat(requestAmount);

  // If the amount is within the creator's own limit → direct Finance bypass, always allowed
  if (amount <= toFloat(creator.approvalLimit)) {
    return { blocked: false, reason: null, maxApprovableLimit: toFloat(creator.approvalLimit) };
  }

  // Amount exceeds creator's limit → need eligible higher approvers
  const allSteps = await loadHierarchySteps(creator.approvalHierarchyId);

  // Bug 3 fix: hierarchyLevel may be null on users created before the field was added.
  // Fall back to finding the creator's own HierarchyStep row by approverId.
  let creatorLevel = creator.hierarchyLevel;
  if (creatorLevel == null && creator.approvalHierarchyId) {
    const ownStep = allSteps.find(s => s.approverId === creator.id);
    creatorLevel  = ownStep ? ownStep.level : 0;
  }
  creatorLevel = creatorLevel ?? 0;

  const { eligible } = classifySteps(allSteps, creatorLevel, amount);

  if (eligible.length === 0) {
    // Find the highest approvalLimitSnapshot in the entire hierarchy for a useful error message
    const maxLimit = allSteps.reduce(
      (max, s) => Math.max(max, toFloat(s.approvalLimitSnapshot)), 0,
    );
    return {
      blocked:             true,
      reason:              `Request amount (${fmt(amount)}) exceeds the maximum approvable limit (${fmt(maxLimit)}) in your approval chain. No eligible approver exists.`,
      maxApprovableLimit:  maxLimit,
    };
  }

  return { blocked: false, reason: null, maxApprovableLimit: null };
};
const submitRequest = async (requestId, userId) => {
  // ── 1. Load request + creator outside the transaction (read-only pre-check) ──
  const request = await prisma.fundRequest.findUnique({
    where:   { id: requestId },
    include: { createdBy: true },
  });

  if (!request)
    throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (request.createdById !== userId)
    throw Object.assign(new Error('Unauthorized'), { statusCode: 403 });

  // Req 7: Permanent rejection blocks resubmission
  if (request.isRejectedPermanently)
    throw Object.assign(
      new Error('Rejected requests cannot be resubmitted.'),
      { statusCode: 400 },
    );

  const allowedStatuses = ['DRAFT', 'NEEDS_REVIEW'];
  if (!allowedStatuses.includes(request.status))
    throw Object.assign(
      new Error(`Only DRAFT or NEEDS_REVIEW requests can be submitted. Current status: ${request.status}`),
      { statusCode: 400 },
    );

  const creator = request.createdBy;

  // ── 2. Req 9: Block if no eligible approver exists ───────────────────────
  const validation = await validateSubmission(creator, request.amount);
  if (validation.blocked)
    throw Object.assign(new Error(validation.reason), { statusCode: 422 });

  // ── 3. Classify all hierarchy steps once (used in transaction) ────────────
  const allSteps      = await loadHierarchySteps(creator.approvalHierarchyId);
  // Bug 3 fix: hierarchyLevel may be null — fall back to the HierarchyStep row
  let creatorLevel = creator.hierarchyLevel;
  if (creatorLevel == null && creator.approvalHierarchyId) {
    const ownStep = allSteps.find(s => s.approverId === creator.id);
    creatorLevel  = ownStep ? ownStep.level : 0;
  }
  creatorLevel = creatorLevel ?? 0;
  const requestAmount = toFloat(request.amount);
  const bypass        = requestAmount <= toFloat(creator.approvalLimit);
  const { eligible, ineligible } = bypass
    ? { eligible: [], ineligible: allSteps.map(s => ({ ...s, ineligibleReason: 'LIMIT_TOO_LOW' })) }
    : classifySteps(allSteps, creatorLevel, requestAmount);

  const isResubmit = request.status === 'NEEDS_REVIEW';
  const newCycle   = isResubmit ? request.approvalCycle + 1 : request.approvalCycle;

  // ── 4. Transaction ─────────────────────────────────────────────────────────
  const result = await prisma.$transaction(async (tx) => {

    if (bypass) {
      //  ── Direct-to-Finance path ──────────────────────────────────────────
      // Still create INELIGIBLE audit steps for every hierarchy member so
      // admins can see the full chain that was bypassed.
      if (ineligible.length > 0) {
        await tx.approvalStep.createMany({
          data: ineligible.map(s => ({
            fundRequestId:       requestId,
            approverId:          s.approverId,
            level:               s.level,
            cycle:               newCycle,
            status:              'INELIGIBLE',
            isEligible:          false,
            ineligibleReason:    s.ineligibleReason,
            approvalLimitAtTime: s.approvalLimitSnapshot,
          })),
        });
      }

      await tx.fundRequest.update({
        where: { id: requestId },
        data: {
          status:            'PENDING_FINANCE_APPROVAL',
          bypassedToFinance: true,
          requesterLevel:    creatorLevel,
          hierarchyId:       creator.approvalHierarchyId ?? null,
          approvalCycle:     newCycle,
          submittedAt:       new Date(),
          viewedByFinanceAt: null,
          isModified:        false,
        },
      });

      await logHistory(tx, {
        fundRequestId: requestId,
        actorId:       userId,
        actorRole:     creator.role,
        action:        ACTIONS.BYPASSED_TO_FINANCE,
        fromStatus:    request.status,
        toStatus:      'PENDING_FINANCE_APPROVAL',
        remarks:       `Amount (${fmt(requestAmount)}) is within requester's own limit (${fmt(creator.approvalLimit)}) — bypassed all managers`,
        approvalCycle: newCycle,
        metadata: {
          bypassedToFinance: true,
          requestAmount,
          requesterLimit:    toFloat(creator.approvalLimit),
          hierarchyId:       creator.approvalHierarchyId,
          cycle:             newCycle,
        },
      });

    } else {
      // ── Manager-approval path ────────────────────────────────────────────

      // Eligible approvers: PENDING + isEligible=true  → visible in their inbox
      if (eligible.length > 0) {
        await tx.approvalStep.createMany({
          data: eligible.map(s => ({
            fundRequestId:       requestId,
            approverId:          s.approverId,
            level:               s.level,
            cycle:               newCycle,
            status:              'PENDING',
            isEligible:          true,
            ineligibleReason:    null,
            approvalLimitAtTime: s.approvalLimitSnapshot,
          })),
        });
      }

      // Ineligible approvers: INELIGIBLE + isEligible=false → audit only, never shown
      if (ineligible.length > 0) {
        await tx.approvalStep.createMany({
          data: ineligible.map(s => ({
            fundRequestId:       requestId,
            approverId:          s.approverId,
            level:               s.level,
            cycle:               newCycle,
            status:              'INELIGIBLE',
            isEligible:          false,
            ineligibleReason:    s.ineligibleReason,
            approvalLimitAtTime: s.approvalLimitSnapshot,
          })),
        });
      }

      await tx.fundRequest.update({
        where: { id: requestId },
        data: {
          status:            'PENDING_MANAGER_APPROVAL',
          bypassedToFinance: false,
          requesterLevel:    creatorLevel,
          hierarchyId:       creator.approvalHierarchyId ?? null,
          approvalCycle:     newCycle,
          totalLevels:       eligible.length,
          currentLevel:      eligible[0]?.level ?? 1,
          submittedAt:       new Date(),
          viewedByManagerAt: null,
          viewedByFinanceAt: null,
          isModified:        false,
        },
      });

      await logHistory(tx, {
        fundRequestId: requestId,
        actorId:       userId,
        actorRole:     creator.role,
        action:        isResubmit ? ACTIONS.RESUBMITTED : ACTIONS.SUBMITTED,
        fromStatus:    request.status,
        toStatus:      'PENDING_MANAGER_APPROVAL',
        remarks: isResubmit
  ? `Cycle ${newCycle} — re-initialized with ${eligible.length} eligible approver(s)`
  : `Routed to ${eligible.length} eligible approver(s); ${ineligible.length} omitted due to insufficient approval authority or hierarchy level`,
        approvalCycle: newCycle,
        metadata: {
          bypassedToFinance: false,
          requestAmount,
          requesterLevel:    creatorLevel,
          hierarchyId:       creator.approvalHierarchyId,
          cycle:             newCycle,
          eligibleManagers:  eligible.length,
          ineligibleManagers: ineligible.length,
        },
      });
    }

    return tx.fundRequest.findUnique({ where: { id: requestId } });
  });
  if (result.status === 'PENDING_MANAGER_APPROVAL') {
    const submitted = await prisma.fundRequest.findUnique({
      where:   { id: requestId },
      include: {
        createdBy: true,
        approvalSteps: {
          where:   { cycle: result.approvalCycle, isEligible: true, status: 'PENDING' },
          include: { approver: { select: { id: true, name: true } } },
        },
      },
    });
    for (const step of submitted.approvalSteps) {
      await notify(
        step.approverId,
        requestId,
        'APPROVAL_REQUIRED',
        'New Fund Request Awaiting Your Approval',
        `${submitted.createdBy.name} submitted "${submitted.title}" for ${fmt(submitted.amount)}. Please review.`,
      );
    }
  }

  if (result.status === 'PENDING_FINANCE_APPROVAL') {
    const req      = await prisma.fundRequest.findUnique({ where: { id: requestId }, include: { createdBy: true } });
    const finUsers = await prisma.user.findMany({ where: { role: 'FINANCE', isActive: true } });
    for (const fu of finUsers) {
      await notify(
        fu.id,
        requestId,
        'FINANCE_REVIEW',
        'New Request in Finance Queue',
        `"${req.title}" (${fmt(req.amount)}) is ready for finance review.`,
      );
    }
  }

  return result;
};

// ─── REQ 2 + 5 + 6: MANAGER APPROVE ─────────────────────────────────────────
//
// Guards:
//   • Approver must have an isEligible=true + PENDING step in the current cycle.
//     (This automatically prevents ineligible managers from approving — Req 2.)
//   • Req 1: approvalLimit = 0 means no eligible step was ever created → 403 naturally.
//
// On approval:
//   • Actor's step → APPROVED
//   • ALL other eligible PENDING steps in the same cycle → SKIPPED  (Req 5: one approval is enough)
//   • INELIGIBLE steps left untouched
//   • FundRequest.approvedByUserId + approvedByName populated  (Req 6)
//   • Status moves to PENDING_FINANCE_APPROVAL

const managerApprove = async (requestId, managerUserId, remarks) => {
  if (!remarks?.trim())
    throw Object.assign(new Error('Remarks are required for approval'), { statusCode: 400 });

  // Fetch the approver's name for the display field
  const approver = await prisma.user.findUnique({
    where:  { id: managerUserId },
    select: { id: true, name: true, approvalLimit: true, role: true },
  });
  if (!approver)
    throw Object.assign(new Error('Approver not found'), { statusCode: 404 });

  // Req 1: approvalLimit = 0 → can never approve
  if (toFloat(approver.approvalLimit) === 0)
    throw Object.assign(
      new Error('Your approval limit is 0. You are not authorised to approve requests.'),
      { statusCode: 403 },
    );

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.fundRequest.findUnique({ where: { id: requestId } });

    if (!request || request.status !== 'PENDING_MANAGER_APPROVAL')
      throw Object.assign(new Error('Request is not pending manager approval'), { statusCode: 400 });

    // Must have an ELIGIBLE + PENDING step (covers Req 2 — ineligible managers have no such step)
    const step = await tx.approvalStep.findFirst({
      where: {
        fundRequestId: requestId,
        approverId:    managerUserId,
        cycle:         request.approvalCycle,
        isEligible:    true,
        status:        'PENDING',
      },
    });

    if (!step)
      throw Object.assign(
        new Error('You do not have an active approval step for this request. You may be ineligible or the request has already been actioned.'),
        { statusCode: 403 },
      );

    // 1. Approve the acting manager's step
    await tx.approvalStep.update({
      where: { id: step.id },
      data:  { status: 'APPROVED', remarks, actionAt: new Date() },
    });

    // 2. SKIP all other eligible PENDING steps in this cycle (Req 5: one is enough)
    await tx.approvalStep.updateMany({
      where: {
        fundRequestId: requestId,
        cycle:         request.approvalCycle,
        isEligible:    true,
        status:        'PENDING',
        id:            { not: step.id },
      },
      data: {
        status:  'SKIPPED',
        remarks: `${approver.name} approved at level ${step.level} — no further manager approval required`,
      },
    });

    // 3. Req 6: Write approver identity to FundRequest for display
    await tx.fundRequest.update({
      where: { id: requestId },
      data: {
        status:            'PENDING_FINANCE_APPROVAL',
        approvedByUserId:  managerUserId,
        approvedByName:    approver.name,
        viewedByFinanceAt: null,
      },
    });

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId:       managerUserId,
      actorRole:     'MANAGER',
      action:        ACTIONS.MANAGER_APPROVED,
      fromStatus:    request.status,
      toStatus:      'PENDING_FINANCE_APPROVAL',
      remarks,
      approvalCycle: request.approvalCycle,
      metadata: {
        level:         step.level,
        approverName:  approver.name,
        approverLimit: toFloat(approver.approvalLimit),
        requestAmount: toFloat(request.amount),
        cycle:         request.approvalCycle,
      },
    });

    return tx.fundRequest.findUnique({ where: { id: requestId } });
  });

  // Notifications
  const updReq   = await prisma.fundRequest.findUnique({ where: { id: requestId }, include: { createdBy: true } });
  const finUsers = await prisma.user.findMany({ where: { role: 'FINANCE', isActive: true } });

  await notify(
    updReq.createdById,
    requestId,
    'STATUS_UPDATE',
    'Your Request Has Been Approved',
    `Your request "${updReq.title}" was approved by ${approver.name} and sent to Finance.`,
  );

  for (const fu of finUsers) {
    await notify(
      fu.id,
      requestId,
      'FINANCE_REVIEW',
      'New Request in Finance Queue',
      `"${updReq.title}" (${fmt(updReq.amount)}) was approved by ${approver.name} and is ready for finance review.`,
    );
  }

  return result;
};

// ─── REQ 7: MANAGER REJECT — PERMANENT, NO RESUBMISSION ──────────────────────
//
// On rejection:
//   • Actor's step → REJECTED
//   • All other eligible PENDING steps → SKIPPED
//   • INELIGIBLE steps left untouched
//   • FundRequest.rejectedByUserId + rejectedByName + rejectionSource='MANAGER'
//   • FundRequest.isRejectedPermanently = true  → blocks all future resubmit calls
//   • Status → REJECTED

const managerReject = async (requestId, managerUserId, remarks) => {
  if (!remarks?.trim())
    throw Object.assign(new Error('Rejection reason is required'), { statusCode: 400 });

  const approver = await prisma.user.findUnique({
    where:  { id: managerUserId },
    select: { id: true, name: true, approvalLimit: true, role: true },
  });
  if (!approver)
    throw Object.assign(new Error('Approver not found'), { statusCode: 404 });

  // Req 1
  if (toFloat(approver.approvalLimit) === 0)
    throw Object.assign(
      new Error('Your approval limit is 0. You are not authorised to reject requests.'),
      { statusCode: 403 },
    );

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.fundRequest.findUnique({ where: { id: requestId } });

    if (!request || request.status !== 'PENDING_MANAGER_APPROVAL')
      throw Object.assign(new Error('Request is not pending manager approval'), { statusCode: 400 });

    const step = await tx.approvalStep.findFirst({
      where: {
        fundRequestId: requestId,
        approverId:    managerUserId,
        cycle:         request.approvalCycle,
        isEligible:    true,
        status:        'PENDING',
      },
    });

    if (!step)
      throw Object.assign(
        new Error('You do not have an active approval step for this request.'),
        { statusCode: 403 },
      );

    // 1. Reject actor's step
    await tx.approvalStep.update({
      where: { id: step.id },
      data:  { status: 'REJECTED', remarks, actionAt: new Date() },
    });

    // 2. Skip all other eligible PENDING steps
    await tx.approvalStep.updateMany({
      where: {
        fundRequestId: requestId,
        cycle:         request.approvalCycle,
        isEligible:    true,
        status:        'PENDING',
        id:            { not: step.id },
      },
      data: {
        status:  'SKIPPED',
        remarks: `${approver.name} rejected at level ${step.level} — request closed`,
      },
    });

    // 3. Req 7: Write rejection identity + permanently lock against resubmission
    await tx.fundRequest.update({
      where: { id: requestId },
      data: {
        status:                'REJECTED',
        rejectedByUserId:       managerUserId,
        rejectedByName:         approver.name,
        rejectionSource:        'MANAGER',
        isRejectedPermanently:  true,   // ← blocks all future submitRequest calls
      },
    });

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId:       managerUserId,
      actorRole:     'MANAGER',
      action:        ACTIONS.MANAGER_REJECTED,
      fromStatus:    request.status,
      toStatus:      'REJECTED',
      remarks,
      approvalCycle: request.approvalCycle,
      metadata: {
        level:         step.level,
        approverName:  approver.name,
        approverLimit: toFloat(approver.approvalLimit),
        requestAmount: toFloat(request.amount),
        cycle:         request.approvalCycle,
      },
    });

    return tx.fundRequest.findUnique({ where: { id: requestId } });
  });

  const rejReq = await prisma.fundRequest.findUnique({
    where: { id: requestId }, include: { createdBy: true },
  });

  await notify(
    rejReq.createdById,
    requestId,
    'REQUEST_REJECTED',
    'Your Request Has Been Rejected',
    `Your request "${rejReq.title}" was rejected by ${approver.name}. Reason: ${remarks}. This request cannot be resubmitted.`,
  );

  return result;
};

// ─── REQ 8: FINANCE APPROVE ───────────────────────────────────────────────────
//
// Finance receives only PENDING_FINANCE_APPROVAL requests.
// On approval: status → FINANCE_APPROVED, completedAt set.
// Notifications go to requester and (if applicable) the manager who approved.

const financeApprove = async (requestId, financeUserId, remarks) => {
  if (!remarks?.trim())
    throw Object.assign(new Error('Remarks are required for approval'), { statusCode: 400 });

  const finUser = await prisma.user.findUnique({
    where:  { id: financeUserId },
    select: { id: true, name: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.fundRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== 'PENDING_FINANCE_APPROVAL')
      throw Object.assign(new Error('Request is not pending finance approval'), { statusCode: 400 });

    await tx.financeReview.create({
      data: { fundRequestId: requestId, reviewedById: financeUserId, action: 'APPROVED', remarks },
    });

    await tx.fundRequest.update({
      where: { id: requestId },
      data:  { status: 'FINANCE_APPROVED', completedAt: new Date() },
    });

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId:       financeUserId,
      actorRole:     'FINANCE',
      action:        ACTIONS.FINANCE_APPROVED,
      fromStatus:    request.status,
      toStatus:      'FINANCE_APPROVED',
      remarks,
      approvalCycle: request.approvalCycle,
      metadata: {
        financeUserName: finUser?.name,
        requestAmount:   toFloat(request.amount),
      },
    });

    return tx.fundRequest.findUnique({ where: { id: requestId } });
  });

  const approved = await prisma.fundRequest.findUnique({
    where: { id: requestId }, include: { createdBy: true },
  });

  await notify(
    approved.createdById,
    requestId,
    'REQUEST_APPROVED',
    'Your Request Has Been Fully Approved',
    `Your request "${approved.title}" (${fmt(approved.amount)}) has been approved by Finance.`,
  );

  // Also notify the manager who approved (if applicable), so they know the full outcome
  if (approved.approvedByUserId) {
    await notify(
      approved.approvedByUserId,
      requestId,
      'STATUS_UPDATE',
      'Finance Approved a Request You Approved',
      `"${approved.title}" that you approved has now been approved by Finance.`,
    );
  }

  return result;
};

// ─── REQ 8: FINANCE REJECT ────────────────────────────────────────────────────
//
// On rejection by Finance: status → FINANCE_REJECTED, isRejectedPermanently = true.
// Like manager rejection, Finance rejection is also terminal (Req 7 spirit applies).

const financeReject = async (requestId, financeUserId, remarks) => {
  if (!remarks?.trim())
    throw Object.assign(new Error('Rejection reason is required'), { statusCode: 400 });

  const finUser = await prisma.user.findUnique({
    where:  { id: financeUserId },
    select: { id: true, name: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.fundRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== 'PENDING_FINANCE_APPROVAL')
      throw Object.assign(new Error('Request is not pending finance approval'), { statusCode: 400 });

    await tx.financeReview.create({
      data: { fundRequestId: requestId, reviewedById: financeUserId, action: 'REJECTED', remarks },
    });

    // Req 7 extended to Finance: also permanent
    await tx.fundRequest.update({
      where: { id: requestId },
      data: {
        status:                'FINANCE_REJECTED',
        completedAt:           new Date(),
        rejectedByUserId:       financeUserId,
        rejectedByName:         finUser?.name ?? 'Finance',
        rejectionSource:        'FINANCE',
        isRejectedPermanently:  true,
      },
    });

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId:       financeUserId,
      actorRole:     'FINANCE',
      action:        ACTIONS.FINANCE_REJECTED,
      fromStatus:    request.status,
      toStatus:      'FINANCE_REJECTED',
      remarks,
      approvalCycle: request.approvalCycle,
      metadata: {
        financeUserName: finUser?.name,
        requestAmount:   toFloat(request.amount),
      },
    });

    return tx.fundRequest.findUnique({ where: { id: requestId } });
  });

  const rejected = await prisma.fundRequest.findUnique({
    where: { id: requestId }, include: { createdBy: true },
  });

  await notify(
    rejected.createdById,
    requestId,
    'REQUEST_REJECTED',
    'Your Request Was Rejected by Finance',
    `Your request "${rejected.title}" was rejected by Finance. Reason: ${remarks}`,
  );

  // Notify the manager who approved it (if any) so they are aware of the Finance decision
  if (rejected.approvedByUserId) {
    await notify(
      rejected.approvedByUserId,
      requestId,
      'STATUS_UPDATE',
      'Finance Rejected a Request You Approved',
      `"${rejected.title}" that you approved was subsequently rejected by Finance. Reason: ${remarks}`,
    );
  }

  return result;
};

// ─── REQ 8: FINANCE NEEDS REVIEW ─────────────────────────────────────────────
//
// Finance can flag a request as needing more information.
// Status → NEEDS_REVIEW. The requester can then edit and resubmit
// (NEEDS_REVIEW is in the allowedStatuses list in submitRequest).
// isRejectedPermanently is NOT set here.

const financeNeedsReview = async (requestId, financeUserId, remarks) => {
  if (!remarks?.trim())
    throw Object.assign(new Error('Review remarks are required'), { statusCode: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.fundRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== 'PENDING_FINANCE_APPROVAL')
      throw Object.assign(new Error('Request is not pending finance approval'), { statusCode: 400 });

    await tx.financeReview.create({
      data: { fundRequestId: requestId, reviewedById: financeUserId, action: 'NEEDS_REVIEW', remarks },
    });

    await tx.fundRequest.update({
      where: { id: requestId },
      data:  { status: 'NEEDS_REVIEW' },
    });

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId:       financeUserId,
      actorRole:     'FINANCE',
      action:        ACTIONS.FINANCE_NEEDS_REVIEW,
      fromStatus:    request.status,
      toStatus:      'NEEDS_REVIEW',
      remarks,
      approvalCycle: request.approvalCycle,
    });

    return tx.fundRequest.findUnique({ where: { id: requestId } });
  });

  const reviewReq = await prisma.fundRequest.findUnique({
    where: { id: requestId }, include: { createdBy: true },
  });

  await notify(
    reviewReq.createdById,
    requestId,
    'NEEDS_REVIEW',
    'Finance Needs More Information on Your Request',
    `Your request "${reviewReq.title}" has been flagged for review: ${remarks}. Please update and resubmit.`,
  );

  return result;
};

// ─── WORKFLOW RECALCULATION (amount/field change while active) ─────────────────
//
// Called from updateRequest when a field changes while status is PENDING_MANAGER_APPROVAL
// or PENDING_FINANCE_APPROVAL. Marks all PENDING eligible steps as SKIPPED,
// then re-runs the full eligibility classification with the new amount.
//
// Edit lock (Req 8): blocked if viewedByManagerAt or viewedByFinanceAt is set.

const recalculateWorkflow = async (requestId, userId) => {
  return prisma.$transaction(async (tx) => {
    const request = await tx.fundRequest.findUnique({
      where:   { id: requestId },
      include: { createdBy: true },
    });
    if (!request)
      throw Object.assign(new Error('Request not found'), { statusCode: 404 });

    // Req 8: lock once viewed
    if (request.viewedByManagerAt || request.viewedByFinanceAt)
      throw Object.assign(
        new Error('Request cannot be modified — it has already been viewed by a manager or Finance.'),
        { statusCode: 400 },
      );

    const creator       = request.createdBy;
    const requestAmount = toFloat(request.amount);

    const allSteps = await loadHierarchySteps(creator.approvalHierarchyId);
    // Bug 3 fix: hierarchyLevel may be null — fall back to the HierarchyStep row
    let creatorLevel = creator.hierarchyLevel;
    if (creatorLevel == null && creator.approvalHierarchyId) {
      const ownStep = allSteps.find(s => s.approverId === creator.id);
      creatorLevel  = ownStep ? ownStep.level : 0;
    }
    creatorLevel = creatorLevel ?? 0;

    // Retire all currently PENDING eligible steps
    await tx.approvalStep.updateMany({
      where: {
        fundRequestId: requestId,
        cycle:         request.approvalCycle,
        isEligible:    true,
        status:        'PENDING',
      },
      data: { status: 'SKIPPED', remarks: 'Workflow recalculated due to request field change' },
    });

    const bypass = requestAmount <= toFloat(creator.approvalLimit);
    const { eligible, ineligible } = bypass
      ? { eligible: [], ineligible: allSteps.map(s => ({ ...s, ineligibleReason: 'LIMIT_TOO_LOW' })) }
      : classifySteps(allSteps, creatorLevel, requestAmount);

    let newStatus;

    if (!bypass && eligible.length > 0) {
      await tx.approvalStep.createMany({
        data: eligible.map(s => ({
          fundRequestId:       requestId,
          approverId:          s.approverId,
          level:               s.level,
          cycle:               request.approvalCycle,
          status:              'PENDING',
          isEligible:          true,
          ineligibleReason:    null,
          approvalLimitAtTime: s.approvalLimitSnapshot,
        })),
      });

      if (ineligible.length > 0) {
        await tx.approvalStep.createMany({
          data: ineligible.map(s => ({
            fundRequestId:       requestId,
            approverId:          s.approverId,
            level:               s.level,
            cycle:               request.approvalCycle,
            status:              'INELIGIBLE',
            isEligible:          false,
            ineligibleReason:    s.ineligibleReason,
            approvalLimitAtTime: s.approvalLimitSnapshot,
          })),
        });
      }

      newStatus = 'PENDING_MANAGER_APPROVAL';
      await tx.fundRequest.update({
        where: { id: requestId },
        data: {
          status:            newStatus,
          bypassedToFinance: false,
          totalLevels:       eligible.length,
          currentLevel:      eligible[0]?.level ?? 1,
          viewedByManagerAt: null,
          viewedByFinanceAt: null,
        },
      });
    } else {
      newStatus = 'PENDING_FINANCE_APPROVAL';
      await tx.fundRequest.update({
        where: { id: requestId },
        data: {
          status:            newStatus,
          bypassedToFinance: true,
          totalLevels:       0,
          currentLevel:      0,
          viewedByFinanceAt: null,
        },
      });
    }

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId:       userId,
      actorRole:     creator.role,
      action:        ACTIONS.WORKFLOW_RECALCULATED,
      fromStatus:    request.status,
      toStatus:      newStatus,
      remarks:       'Request updated — workflow re-evaluated with new data',
      approvalCycle: request.approvalCycle,
      metadata: {
        requestAmount,
        bypassedToFinance: bypass || eligible.length === 0,
        eligibleManagers:  eligible.length,
        ineligibleManagers: ineligible.length,
      },
    });

    return tx.fundRequest.findUnique({ where: { id: requestId } });
  });
};

// ─── EXPORTED UTILITIES ───────────────────────────────────────────────────────
//
// validateSubmission — call from your controller/frontend-check endpoint
//   before showing the Submit button (Req 9).
//
// loadHierarchySteps — useful for admin screens showing who is in a chain.

module.exports = {
  // Core workflow
  submitRequest,
  managerApprove,
  managerReject,
  financeApprove,
  financeReject,
  financeNeedsReview,
  recalculateWorkflow,
  validateSubmission,
  loadHierarchySteps,
  classifySteps,
};