// src/services/finance.service.js
//
// Changes:
//   • requestInclude: added new FundRequest scalar fields
//     (approvedByName, rejectedByName, rejectionSource, bypassedToFinance)
//     so Finance detail views can show "Approved by Kishore" / "Rejected by Ravi"
//     without extra joins (Req 6+7).
//   • requestInclude.approvalSteps: added isEligible filter — Finance detail
//     views should only show eligible steps in the approval chain display,
//     not the INELIGIBLE audit-only steps.
//   • getFinanceQueue / getFinanceDashboardStats: no logic changes — filters
//     were already correct in the provided version.

'use strict';

const prisma = require('../config/db');

const FINANCE_STATUSES = [
  'PENDING_FINANCE_APPROVAL',
  'FINANCE_APPROVED',
  'FINANCE_REJECTED',
  'NEEDS_REVIEW',
];

const STATUS_MAP = {
  pending:                  'PENDING_FINANCE_APPROVAL',
  approved:                 'FINANCE_APPROVED',
  rejected:                 'FINANCE_REJECTED',
  review:                   'NEEDS_REVIEW',
  PENDING_FINANCE_APPROVAL: 'PENDING_FINANCE_APPROVAL',
  FINANCE_APPROVED:         'FINANCE_APPROVED',
  FINANCE_REJECTED:         'FINANCE_REJECTED',
  NEEDS_REVIEW:             'NEEDS_REVIEW',
};

// NEW: approvedByName + rejectedByName are scalar fields on FundRequest —
// Prisma returns all scalars by default so no explicit select needed.
// We do add isEligible: true to approvalSteps so Finance only sees the
// relevant chain, not ineligible audit entries.
const requestInclude = {
  createdBy: {
    select: {
      id: true, name: true, email: true,
      department: { select: { id: true, name: true } },
    },
  },
  approvalSteps: {
    // NEW: only eligible steps in the Finance view (INELIGIBLE are audit-only)
    where:   { isEligible: true },
    include: { approver: { select: { id: true, name: true } } },
    orderBy: [{ cycle: 'asc' }, { level: 'asc' }],
  },
  financeReviews: {
    include: { reviewedBy: { select: { id: true, name: true } } },
    orderBy: { reviewedAt: 'desc' },
  },
  attachments: { where: { isDeleted: false } },
  _count:      { select: { attachments: true } },
};

// ─── Finance Queue ────────────────────────────────────────────────────────────

const getFinanceQueue = async (
  page = 1, limit = 10,
  statusParam, deptFilter, hierarchyFilter, searchParam,
) => {
  page  = Number(page)  || 1;
  limit = Number(limit) || 10;

  const where = { isDeleted: false };

  if (statusParam) {
    const resolved = STATUS_MAP[statusParam];
    if (resolved) where.status = resolved;
  } else {
    where.status = 'PENDING_FINANCE_APPROVAL';
  }

  const createdByFilter = {};

  if (deptFilter) {
    const deptId = parseInt(deptFilter);
    if (!isNaN(deptId)) createdByFilter.departmentId = deptId;
  }

  if (hierarchyFilter) {
    const hierId = parseInt(hierarchyFilter);
    if (!isNaN(hierId)) createdByFilter.approvalHierarchyId = hierId;
  }

  if (Object.keys(createdByFilter).length > 0) {
    where.createdBy = createdByFilter;
  }

  if (searchParam?.trim()) {
    const searchTerm = searchParam.trim();
    where.OR = [
      { requestNumber: { contains: searchTerm } },
      { title:         { contains: searchTerm } },
      { createdBy:     { name: { contains: searchTerm } } },
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.fundRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { updatedAt: 'asc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.fundRequest.count({ where }),
  ]);

  return { requests, total };
};

// ─── Finance Dashboard Stats ──────────────────────────────────────────────────

const getFinanceDashboardStats = async (deptFilter, hierarchyFilter) => {
  const base        = { isDeleted: false };
  const whereFilter = { ...base };

  const createdByFilter = {};

  if (deptFilter) {
    const deptId = parseInt(deptFilter);
    if (!isNaN(deptId)) createdByFilter.departmentId = deptId;
  }

  if (hierarchyFilter) {
    const hierId = parseInt(hierarchyFilter);
    if (!isNaN(hierId)) createdByFilter.approvalHierarchyId = hierId;
  }

  if (Object.keys(createdByFilter).length > 0) {
    whereFilter.createdBy = createdByFilter;
  }

  let hierarchies = [];
  if (deptFilter && !isNaN(parseInt(deptFilter))) {
    hierarchies = await prisma.approvalHierarchy.findMany({
      where:   { departmentId: parseInt(deptFilter), isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  const [
    pending, approved, rejected, needsReview,
    pendingAgg, approvedAgg, rejectedAgg,
    deptSpendingRaw, recentApproved, allDepts,
  ] = await Promise.all([
    prisma.fundRequest.count({ where: { ...whereFilter, status: 'PENDING_FINANCE_APPROVAL' } }),
    prisma.fundRequest.count({ where: { ...whereFilter, status: 'FINANCE_APPROVED' } }),
    prisma.fundRequest.count({ where: { ...whereFilter, status: 'FINANCE_REJECTED' } }),
    prisma.fundRequest.count({ where: { ...whereFilter, status: 'NEEDS_REVIEW' } }),
    prisma.fundRequest.aggregate({ where: { ...whereFilter, status: 'PENDING_FINANCE_APPROVAL' }, _sum: { amount: true } }),
    prisma.fundRequest.aggregate({ where: { ...whereFilter, status: 'FINANCE_APPROVED' },         _sum: { amount: true } }),
    prisma.fundRequest.aggregate({ where: { ...whereFilter, status: 'FINANCE_REJECTED' },         _sum: { amount: true } }),
    prisma.fundRequest.groupBy({
      by:     ['createdById'],
      where:  { ...whereFilter, status: 'FINANCE_APPROVED' },
      _sum:   { amount: true },
      _count: { id: true },
    }),
    prisma.fundRequest.findMany({
      where:   { ...whereFilter, status: 'FINANCE_APPROVED' },
      include: {
        createdBy:     { select: { id: true, name: true, department: true } },
        financeReviews: {
          where:   { action: 'APPROVED' },
          orderBy: { reviewedAt: 'desc' },
          take:    1,
        },
      },
      orderBy: { completedAt: 'desc' },
      take:    5,
    }),
    prisma.department.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const creatorIds = deptSpendingRaw.map(d => d.createdById);
  const deptMap    = {};
  if (creatorIds.length > 0) {
    const creators = await prisma.user.findMany({
      where:   { id: { in: creatorIds } },
      include: { department: true },
    });
    const cMap = Object.fromEntries(creators.map(c => [c.id, c]));
    deptSpendingRaw.forEach(row => {
      const dept = cMap[row.createdById]?.department;
      if (!dept) return;
      if (!deptMap[dept.id])
        deptMap[dept.id] = { id: dept.id, name: dept.name, amount: 0, count: 0 };
      deptMap[dept.id].amount += parseFloat(row._sum.amount || 0);
      deptMap[dept.id].count  += row._count.id;
    });
  }

  const departmentSpending = Object.values(deptMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  return {
    counts: { pending, approved, rejected, needsReview },
    amounts: {
      pending:  parseFloat(pendingAgg._sum.amount  || 0),
      approved: parseFloat(approvedAgg._sum.amount || 0),
      rejected: parseFloat(rejectedAgg._sum.amount || 0),
    },
    departmentSpending,
    recentApproved,
    departments: allDepts,
    hierarchies,
  };
};

module.exports = { getFinanceQueue, getFinanceDashboardStats, FINANCE_STATUSES };