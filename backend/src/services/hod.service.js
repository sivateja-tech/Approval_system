const prisma=require('../config/db');
const getPendingApprovals = async (hodUserId, page = 1, limit = 10) => {
   page = Number(page) || 1;
  limit = Number(limit) || 10;
  const where = {
    approverId: hodUserId,
    status:     'PENDING',
  };

  const [steps, total] = await Promise.all([
    prisma.approvalStep.findMany({
      where,
      include: {
        fundRequest: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true, department: true },
            },
            _count: {
              select: { attachments: true, comments: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip:    (page - 1) * limit,
      take:    (limit),
    }),
    prisma.approvalStep.count({ where }),
  ]);

  return { steps, total };
};
const getApprovalHistory = async (hodUserId, page = 1, limit = 10, filter) => {
  // filter: 'approved' | 'rejected' | undefined (all)
  const where = {
    approverId: hodUserId,
  };

  // Only show APPROVED or REJECTED steps (not PENDING/WAITING)
  if (filter === 'approved') {
    where.status = 'APPROVED';
  } else if (filter === 'rejected') {
    where.status = 'REJECTED';
  } else {
    // default: show both approved and rejected
    where.status = { in: ['APPROVED', 'REJECTED'] };
  }

  const [steps, total] = await Promise.all([
    prisma.approvalStep.findMany({
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
          },
        },
      },
      orderBy: { actionAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    Number(limit),
    }),
    prisma.approvalStep.count({ where }),
  ]);

  return {
    steps,
    total,
    pagination: {
      page: Number(page), limit: Number(limit),
      total, pages: Math.ceil(total / limit),
    },
  };
};

const getHODDashboardStats = async (hodUserId) => {
  // Count the HOD's own approval steps (not fund requests)
  const [pending, approved, rejected] = await Promise.all([
    // Steps currently waiting for THIS HOD to act
    prisma.approvalStep.count({
      where: {
        approverId: hodUserId,
        status: 'PENDING',
        // Only count if the fund request is still active
        fundRequest: {
          status: 'PENDING_HOD_APPROVAL',
          isDeleted: false,
        },
      },
    }),
    // Steps this HOD has approved
    prisma.approvalStep.count({
      where: {
        approverId: hodUserId,
        status: 'APPROVED',
      },
    }),
    // Steps this HOD has rejected
    prisma.approvalStep.count({
      where: {
        approverId: hodUserId,
        status: 'REJECTED',
      },
    }),
  ]);

  return { pending, approved, rejected };
};
module.exports = { getPendingApprovals, getApprovalHistory, getHODDashboardStats };