// src/services/manager.service.js
//
// Changes from previous version:
//   • getPendingApprovals: added isEligible: true filter — ineligible managers
//     never see requests in their pending queue (Req 3).
//   • getApprovalHistory: added isEligible: true filter; removed the manual
//     creatorLimit > reqAmount auto-skip guard (now handled at step creation
//     via isEligible flag — no need to re-derive it here).
//   • getHODDashboardStats: same — isEligible: true replaces the manual
//     creatorLimit check; INELIGIBLE status excluded from counts.
//   • getManagerRequestDetails: isEligible: true added to myStep lookup;
//     fixed the stray `isCreator` reference that caused a ReferenceError.
//   • canAct now also checks isEligible on the current-cycle step.

'use strict';

const prisma = require('../config/db');

// ─── PENDING APPROVALS ────────────────────────────────────────────────────────
// Req 3: Only ELIGIBLE steps (isEligible=true) surface in the inbox.
// Ineligible managers (limit too low / level too low) never see the request.

const getPendingApprovals = async (managerUserId, page = 1, limit = 10, search) => {
  page  = Number(page)  || 1;
  limit = Number(limit) || 10;

  // Bug 3 fix: Filter by PENDING + isEligible=true AND the step's cycle must
  // match the fund request's current approvalCycle.
  // Without the cycle check, a manager whose step was SKIPPED by a
  // recalculation (old cycle) and then got a new PENDING step in the new cycle
  // would only see the old SKIPPED step if the new one wasn't yet picked up.
  // More importantly — we must not surface a request where the ONLY
  // isEligible+PENDING step belongs to a now-superseded cycle.
  // Prisma doesn't support cross-table column comparison directly, so we
  // do it via a raw subquery approach: filter step.cycle = fundRequest.approvalCycle.
  const where = {
    approverId: managerUserId,
    status:     'PENDING',
    isEligible: true,
    fundRequest: {
      isDeleted: false,
      status:    'PENDING_MANAGER_APPROVAL',
    },
  };

  if (search?.trim()) {
    where.fundRequest.OR = [
      { title:         { contains: search.trim() } },
      { requestNumber: { contains: search.trim() } },
    ];
  }

  const steps = await prisma.approvalStep.findMany({
    where,
    include: {
      fundRequest: {
        include: {
          createdBy: {
            select: {
              id: true, name: true, email: true,
              department: { select: { id: true, name: true } },
            },
          },
          _count: { select: { attachments: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Bug 3: Post-filter — only keep steps whose cycle matches the request's
  // current approvalCycle (guards against superseded recalculation steps)
  const currentCycleSteps = steps.filter(
    s => s.cycle === s.fundRequest.approvalCycle
  );

  // Deduplicate — keep only the first (latest) step per request
  const seen        = new Set();
  const uniqueSteps = [];
  for (const step of currentCycleSteps) {
    if (!seen.has(step.fundRequestId)) {
      seen.add(step.fundRequestId);
      uniqueSteps.push(step);
    }
  }

  const start          = (page - 1) * limit;
  const paginatedSteps = uniqueSteps.slice(start, start + limit);

  return {
    steps: paginatedSteps,
    total: uniqueSteps.length,
    pagination: {
      page, limit,
      total: uniqueSteps.length,
      pages: Math.ceil(uniqueSteps.length / limit),
    },
  };
};

// ─── APPROVAL HISTORY ─────────────────────────────────────────────────────────
// Req 3+5: Only ELIGIBLE steps appear in history.
//          SKIPPED (but eligible) steps are shown so managers can see they
//          were bypassed by a peer (Req 5).
// CHANGED: removed the manual creatorLimit check — isEligible=true already
//          guarantees the step was legitimately part of the approval chain.

const getApprovalHistory = async (managerUserId, page = 1, limit = 10, filter, search) => {
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {
    approverId: managerUserId,
    isEligible: true,                          // ← NEW: exclude INELIGIBLE audit steps
    status:     { notIn: ['PENDING', 'WAITING', 'INELIGIBLE'] },
    fundRequest: {
      isDeleted: false,
      status:    { not: 'CANCELLED' },
    },
  };

  if (search?.trim()) {
    where.fundRequest.OR = [
      { title:         { contains: search.trim() } },
      { requestNumber: { contains: search.trim() } },
    ];
  }

  if (filter) {
    const safeFilter = filter.toUpperCase();
    if (['APPROVED', 'REJECTED', 'SKIPPED'].includes(safeFilter)) {
      where.status = safeFilter;
    }
  }

  const allSteps = await prisma.approvalStep.findMany({
    where,
    include: {
      fundRequest: {
        include: {
          createdBy: {
            select: {
              name: true,
              department: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ cycle: 'desc' }, { actionAt: 'desc' }],
    distinct: ['fundRequestId'],
  });

  // Keep only steps from the current active cycle
  const validSteps = allSteps.filter(s => s.cycle === s.fundRequest.approvalCycle);

  const total          = validSteps.length;
  const paginatedSteps = validSteps.slice(skip, skip + take);

  return {
    steps: paginatedSteps,
    pagination: {
      page:  Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

// ─── MANAGER DASHBOARD STATS ──────────────────────────────────────────────────
// CHANGED: isEligible: true replaces the old manual creatorLimit derivation.
//          INELIGIBLE steps are explicitly excluded so counts stay accurate.

const getHODDashboardStats = async (managerUserId) => {
  const allSteps = await prisma.approvalStep.findMany({
    where: {
      approverId: managerUserId,
      isEligible: true,                            // ← NEW: only eligible steps count
      status:     { notIn: ['WAITING', 'INELIGIBLE'] },
      fundRequest: {
        isDeleted: false,
        status:    { not: 'CANCELLED' },
      },
    },
    include: {
      fundRequest: true,
    },
    orderBy: [{ cycle: 'desc' }, { actionAt: 'desc' }],
  });

  // Deduplicate — newest step per fund request
  const latestMap = new Map();
  for (const step of allSteps) {
    if (!latestMap.has(step.fundRequestId)) {
      latestMap.set(step.fundRequestId, step);
    }
  }

  let pending  = 0;
  let approved = 0;
  let rejected = 0;
  let skipped  = 0;

  for (const step of latestMap.values()) {
    // Must be from the current active cycle
    if (step.cycle !== step.fundRequest.approvalCycle) continue;

    if (step.status === 'PENDING' && step.fundRequest.status === 'PENDING_MANAGER_APPROVAL') {
      pending++;
    } else if (step.status === 'APPROVED') {
      approved++;
    } else if (step.status === 'REJECTED') {
      rejected++;
    } else if (step.status === 'SKIPPED') {
      // isEligible=true already guarantees this is a genuine skip, not an auto-ineligible
      skipped++;
    }
  }

  return { pending, approved, rejected, skipped };
};

// ─── GET REQUEST DETAILS FOR MANAGER ─────────────────────────────────────────
// Req 3+5: Only managers with an ELIGIBLE step can view.
// Req 8: Marks as viewed → locks editing for requester.
// canAct: true only if the manager has an isEligible=true PENDING step in the
//         current cycle AND the request is still PENDING_MANAGER_APPROVAL.
// FIXED: removed stray `isCreator` reference from previous version.

const getManagerRequestDetails = async (requestId, managerUserId) => {
  const id = parseInt(requestId);
  if (isNaN(id)) throw Object.assign(new Error('Invalid request ID'), { statusCode: 400 });

  // First load the request so we know the current approvalCycle
  const fundReq = await prisma.fundRequest.findUnique({
    where:  { id, isDeleted: false },
    select: { approvalCycle: true },
  });
  if (!fundReq) throw Object.assign(new Error('Request not found'), { statusCode: 404 });

  // Bug 3 fix: Access is granted ONLY when the manager has an ELIGIBLE step
  // in the CURRENT cycle that is NOT merely SKIPPED due to a recalculation.
  //
  // Why: recalculateWorkflow marks the old PENDING eligible steps as SKIPPED
  // but does NOT flip isEligible to false. So Manish ends up with
  //   { cycle: 1, isEligible: true, status: SKIPPED }
  // after the amount is raised and the chain changes. If we only check
  // isEligible=true (any cycle, any status) he can still access the request.
  //
  // Rule: a SKIPPED step from the current cycle means the manager WAS eligible
  // but a PEER acted first — they should still have read-only access (Req 5).
  //
  // A SKIPPED step from a PREVIOUS cycle (recalculation) means the manager
  // is no longer in the chain at all — deny access.
  //
  // To handle this cleanly we check two conditions:
  //   a) Manager has an isEligible=true step in the CURRENT cycle (any status)
  //   b) OR manager has an isEligible=true APPROVED/REJECTED step (acted already)
  //
  // If only a SKIPPED step exists and it belongs to an older cycle → deny.

  const currentCycle = fundReq.approvalCycle;

  const myStep = await prisma.approvalStep.findFirst({
    where: {
      fundRequestId: id,
      approverId:    managerUserId,
      isEligible:    true,
      OR: [
        // Current cycle — any status (PENDING, APPROVED, REJECTED, SKIPPED by peer)
        { cycle: currentCycle },
        // Any cycle but already acted (historical read-only access)
        { status: { in: ['APPROVED', 'REJECTED'] } },
      ],
    },
    orderBy: [{ cycle: 'desc' }],
  });

  if (!myStep)
    throw Object.assign(
      new Error("Access denied — not in this request's approval chain"),
      { statusCode: 403 },
    );

  // Req 8: Mark as viewed (only the first time — don't overwrite)
  await prisma.fundRequest.updateMany({
    where: { id, viewedByManagerAt: null },
    data:  { viewedByManagerAt: new Date() },
  }).catch(() => {});

  const request = await prisma.fundRequest.findUnique({
    where:   { id, isDeleted: false },
    include: {
      createdBy: {
        select: {
          id: true, name: true, email: true, role: true,
          approvalLimit: true, hierarchyLevel: true,
          department: { select: { id: true, name: true } },
        },
      },
      approvalSteps: {
        // Return all steps; frontend uses isEligible to differentiate visible vs. audit
        include: { approver: { select: { id: true, name: true, email: true } } },
        orderBy: [{ cycle: 'asc' }, { level: 'asc' }],
      },
      financeReviews: {
        include: { reviewedBy: { select: { id: true, name: true } } },
        orderBy: { reviewedAt: 'desc' },
      },
      attachments: {
        where:   { isDeleted: false },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });

  const { safeGetHistory } = require('./request.service');
  const workflowHistory    = await safeGetHistory(id);

  // canAct: manager must have an isEligible=true PENDING step in the current cycle
  const currentCycleStep = request.approvalSteps.find(
    s => s.approverId === managerUserId
      && s.cycle      === request.approvalCycle
      && s.isEligible === true          // ← NEW
      && s.status     === 'PENDING',
  );
  const canAct = !!currentCycleStep && request.status === 'PENDING_MANAGER_APPROVAL';

  return {
    ...request,
    workflowHistory,
    canAct,
    myCurrentStep: currentCycleStep || null,
    isViewOnly:    !canAct,
  };
};

module.exports = {
  getPendingApprovals,
  getApprovalHistory,
  getHODDashboardStats,
  getManagerRequestDetails,
};