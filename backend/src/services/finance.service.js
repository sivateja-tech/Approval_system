const prisma = require('../config/db');

// ─── Map frontend status params to DB enum values ────────────────────────
const STATUS_MAP = {
  pending:    'PENDING_FINANCE_APPROVAL',
  approved:   'FINANCE_APPROVED',
  rejected:   'FINANCE_REJECTED',
  review:     'NEEDS_REVIEW',
  // also accept direct enum values
  PENDING_FINANCE_APPROVAL: 'PENDING_FINANCE_APPROVAL',
  FINANCE_APPROVED:         'FINANCE_APPROVED',
  FINANCE_REJECTED:         'FINANCE_REJECTED',
  NEEDS_REVIEW:             'NEEDS_REVIEW',
};

const requestInclude = {
  createdBy: {
    select: { id: true, name: true, email: true, department: true },
  },
  approvalSteps: {
    include: { approver: { select: { id: true, name: true } } },
    orderBy: { hodLevel: 'asc' },
  },
  financeReviews: {
    include: { reviewedBy: { select: { id: true, name: true } } },
    orderBy: { reviewedAt: 'desc' },
  },
  _count: { select: { attachments: true, comments: true } },
};

const getFinanceQueue = async (page = 1, limit = 10, statusParam) => {
  const where = { isDeleted: false };

  if (statusParam) {
    const resolved = STATUS_MAP[statusParam];
    if (!resolved) throw new Error('Finance cannot filter by this status');
    where.status = resolved;
  } else {
    // Default: only pending finance approval
    where.status = 'PENDING_FINANCE_APPROVAL';
  }

  const [requests, total] = await Promise.all([
    prisma.fundRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { updatedAt: 'asc' },
      skip:  (page - 1) * limit,
      take:  Number(limit),
    }),
    prisma.fundRequest.count({ where }),
  ]);

  return { requests, total };
};

// ─── Finance dashboard stats — counts + amounts ───────────────────────────
const getFinanceDashboardStats = async (deptFilter) => {
  const base = { isDeleted: false };

  // If dept filter provided, only count requests from that dept
  const deptWhere = deptFilter
    ? { ...base, createdBy: { departmentId: parseInt(deptFilter) } }
    : base;

  const [
    pending, approved, rejected, needsReview,
    pendingAmt, approvedAmt, rejectedAmt,
    deptSpending, recentApproved, allDepts,
    deptRequestCounts,
  ] = await Promise.all([
    prisma.fundRequest.count({ where: { ...deptWhere, status: 'PENDING_FINANCE_APPROVAL' } }),
    prisma.fundRequest.count({ where: { ...deptWhere, status: 'FINANCE_APPROVED' } }),
    prisma.fundRequest.count({ where: { ...deptWhere, status: 'FINANCE_REJECTED' } }),
    prisma.fundRequest.count({ where: { ...deptWhere, status: 'NEEDS_REVIEW' } }),

    prisma.fundRequest.aggregate({
      where: { ...deptWhere, status: 'PENDING_FINANCE_APPROVAL' },
      _sum: { amount: true },
    }),
    prisma.fundRequest.aggregate({
      where: { ...deptWhere, status: 'FINANCE_APPROVED' },
      _sum: { amount: true },
    }),
    prisma.fundRequest.aggregate({
      where: { ...deptWhere, status: 'FINANCE_REJECTED' },
      _sum: { amount: true },
    }),

    // Dept spending — group approved requests by department
    prisma.fundRequest.groupBy({
      by: ['createdById'],
      where: { ...base, status: 'FINANCE_APPROVED' },
      _sum: { amount: true },
      _count: { id: true },
    }),

    // Recent approved
    prisma.fundRequest.findMany({
      where: { ...deptWhere, status: 'FINANCE_APPROVED' },
      include: {
        createdBy: {
          select: { id: true, name: true, department: true },
        },
        financeReviews: {
          where: { action: 'APPROVED' },
          orderBy: { reviewedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
    }),

    // All departments for dropdown
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),

    // Total requests per dept (all statuses that reached finance)
    prisma.fundRequest.groupBy({
      by: ['createdById'],
      where: {
        ...base,
        status: {
          in: [
            'PENDING_FINANCE_APPROVAL', 'FINANCE_APPROVED',
            'FINANCE_REJECTED', 'NEEDS_REVIEW',
          ],
        },
      },
      _count: { id: true },
    }),
  ]);

  // Resolve dept spending
  const creatorIds = deptSpending.map(d => d.createdById);
  const creators = creatorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: creatorIds } },
        
        select: { id: true, department: true },
      })
    : [];
  const creatorMap = Object.fromEntries(creators.map(c => [c.id, c]));

  const deptMap = {};
  deptSpending.forEach(row => {
    const dept = creatorMap[row.createdById]?.department;
    if (!dept) return;
    if (!deptMap[dept.id]) {
      deptMap[dept.id] = { id: dept.id, name: dept.name, amount: 0, count: 0 };
    }
    deptMap[dept.id].amount += parseFloat(row._sum.amount || 0);
    deptMap[dept.id].count  += row._count.id;
  });

  // Total requests per dept reaching finance
  const deptCountMap = {};
  const countCreatorIds = deptRequestCounts.map(r => r.createdById);
  if (countCreatorIds.length) {
    const countCreators = await prisma.user.findMany({
  where: {
    id: { in: countCreatorIds },
  },

  select: {
    id: true,

    department: {
      select: {
        id: true,
        name: true,
      },
    },
  },
});
    const countMap = Object.fromEntries(countCreators.map(c => [c.id, c]));
    deptRequestCounts.forEach(row => {
      const dept = countMap[row.createdById]?.department;
      if (!dept) return;
      if (!deptCountMap[dept.id]) {
        deptCountMap[dept.id] = { id: dept.id, name: dept.name, total: 0 };
      }
      deptCountMap[dept.id].total += row._count.id;
    });
  }

  const departmentSpending = Object.values(deptMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const departmentRequests = Object.values(deptCountMap)
    .sort((a, b) => b.total - a.total);

  return {
    counts:   { pending, approved, rejected, needsReview },
    amounts:  {
      pending:  parseFloat(pendingAmt._sum.amount  || 0),
      approved: parseFloat(approvedAmt._sum.amount || 0),
      rejected: parseFloat(rejectedAmt._sum.amount || 0),
    },
    departmentSpending,
    departmentRequests,
    recentApproved,
    departments: allDepts,
  };
};

module.exports = { getFinanceQueue, getFinanceDashboardStats };