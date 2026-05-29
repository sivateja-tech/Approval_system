const prisma = require('../config/db');
const { generateRequestNumber } = require('../utils/requestNumber.util');

const notificationService = require('./notification.service');
const socketHandler = require('../sockets/socket.handler');


// ─────────────────────────────────────────────────────────
// Notification Helper
// ─────────────────────────────────────────────────────────

const notify = async (userId, fundRequestId, type, title, message) => {
  try {

    const notif = await notificationService.createNotification({
      userId,
      fundRequestId,
      type,
      title,
      message,
    });

    socketHandler.notifyUser(userId, 'new_notification', notif);

  } catch (e) {
    console.error('Notify error:', e.message);
  }
};


// ─────────────────────────────────────────────────────────

const needsHODApproval = (amount, userApprovalLimit) => {
  return parseFloat(amount) > parseFloat(userApprovalLimit);
};


// ─────────────────────────────────────────────────────────

const getHODHierarchy = async (departmentId) => {

  return prisma.hODHierarchy.findMany({
    where: {
      departmentId,
      isActive: true,
    },

    include: {
      user: true,
    },

    orderBy: {
      level: 'asc',
    },
  });
};


// ─────────────────────────────────────────────────────────

const createApprovalSteps = async (fundRequestId, hODHierarchy) => {

  const steps = hODHierarchy.map((hod, index) => ({
    fundRequestId,
    approverId: hod.userId,
    hodLevel: hod.level,
    status: index === 0 ? 'PENDING' : 'WAITING',
  }));

  await prisma.approvalStep.createMany({
    data: steps,
  });
};


// ─────────────────────────────────────────────────────────

const logHistory = async (
  tx,
  {
    fundRequestId,
    actorId,
    actorRole,
    action,
    fromStatus,
    toStatus,
    remarks,
    metadata,
  }
) => {

  return tx.workflowHistory.create({
    data: {
      fundRequestId,
      actorId,
      actorRole,
      action,
      fromStatus,
      toStatus,
      remarks,
      metadata,
    },
  });
};


// ─────────────────────────────────────────────────────────
// SUBMIT REQUEST
// ─────────────────────────────────────────────────────────

const submitRequest = async (requestId, userId) => {

  const result = await prisma.$transaction(async (tx) => {

    const request = await tx.fundRequest.findUnique({
      where: { id: requestId },
      include: { createdBy: true },
    });

    console.log(userId);

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.createdById !== userId) {
      throw new Error('Unauthorized');
    }

    if (!['DRAFT', 'NEEDS_REVIEW'].includes(request.status)) {
      throw new Error('Only DRAFT or NEEDS_REVIEW requests can be submitted');
    }

    const user = request.createdBy;

    const hodHierarchy = await getHODHierarchy(user.departmentId);

    let newStatus;
    let nextAction;

    if (
      needsHODApproval(request.amount, user.approvalLimit) &&
      hodHierarchy.length > 0
    ) {

      newStatus = 'PENDING_HOD_APPROVAL';

      nextAction = 'SUBMITTED_FOR_HOD_APPROVAL';

      const existingStepCount = await tx.approvalStep.count({
        where: {
          fundRequestId: requestId,
        },
      });

      if (existingStepCount === 0) {

        const steps = hodHierarchy.map((hod, index) => ({
          fundRequestId: requestId,
          approverId: hod.userId,
          hodLevel: hod.level,
          status: index === 0 ? 'PENDING' : 'WAITING',
        }));

        await tx.approvalStep.createMany({
          data: steps,
        });

      } else {

        await tx.approvalStep.updateMany({
          where: {
            fundRequestId: requestId,
          },

          data: {
            status: 'WAITING',
            remarks: null,
            actionAt: null,
          },
        });

        const levelOneStep = await tx.approvalStep.findFirst({
          where: {
            fundRequestId: requestId,
            hodLevel: 1,
          },
        });

        if (!levelOneStep) {
          throw new Error(
            'Level 1 approval step not found during resubmission'
          );
        }

        await tx.approvalStep.update({
          where: {
            id: levelOneStep.id,
          },

          data: {
            status: 'PENDING',
          },
        });
      }

      await tx.fundRequest.update({
        where: {
          id: requestId,
        },

        data: {
          status: newStatus,
          currentLevel: 1,
          totalHodLevels: hodHierarchy.length,
          submittedAt: new Date(),
        },
      });

    } else {

      newStatus = 'PENDING_FINANCE_APPROVAL';

      nextAction = 'SUBMITTED_TO_FINANCE';

      await tx.fundRequest.update({
        where: {
          id: requestId,
        },

        data: {
          status: newStatus,
          submittedAt: new Date(),
        },
      });
    }

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId: userId,
      actorRole: 'USER',
      action: nextAction,
      fromStatus: request.status,
      toStatus: newStatus,

      remarks:
        request.status === 'NEEDS_REVIEW'
          ? 'Resubmitted after HOD rejection — full chain restarts from Level 1'
          : 'Request submitted',
    });

    return tx.fundRequest.findUnique({
      where: {
        id: requestId,
      },
    });
  });


  // ─────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────

  const request = await prisma.fundRequest.findUnique({
    where: { id: requestId },
    include: { createdBy: true },
  });

  const user = request.createdBy;

  const hodHierarchy = await getHODHierarchy(user.departmentId);


  // Notify Level 1 HOD

  if (
    result.status === 'PENDING_HOD_APPROVAL' &&
    hodHierarchy.length > 0
  ) {

    const levelOneHOD = hodHierarchy[0];

    await notify(
      levelOneHOD.userId,
      requestId,
      'APPROVAL_REQUIRED',
      'New approval request',
      `${user.name} submitted "${request.title}" (₹${request.amount}) for your approval.`
    );
  }


  // Notify Finance

  if (result.status === 'PENDING_FINANCE_APPROVAL') {

    const financeUsers = await prisma.user.findMany({
      where: {
        role: 'FINANCE',
        isActive: true,
      },
    });

    for (const fu of financeUsers) {

      await notify(
        fu.id,
        requestId,
        'FINANCE_REVIEW',
        'New request for review',
        `${user.name} submitted "${request.title}" for finance approval.`
      );
    }
  }

  return result;
};


// ─────────────────────────────────────────────────────────
// HOD APPROVE
// ─────────────────────────────────────────────────────────

const hodApprove = async (requestId, hodUserId, remarks) => {
  if (!remarks?.trim()) throw new Error('Remarks are required for approval.');

  const result = await prisma.$transaction(async (tx) => {
    
    const request = await tx.fundRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== 'PENDING_HOD_APPROVAL') {
      throw new Error('Request is not pending HOD approval');
    }

    const step = await tx.approvalStep.findFirst({
      where: {
        fundRequestId: requestId,
        approverId: hodUserId,
        status: 'PENDING',
      },
    });

    if (!step) {
      throw new Error('No pending approval step found for this HOD');
    }

    await tx.approvalStep.update({
      where: { id: step.id },

      data: {
        status: 'APPROVED',
        remarks,
        actionAt: new Date(),
      },
    });

    const nextStep = await tx.approvalStep.findFirst({
      where: {
        fundRequestId: requestId,
        hodLevel: step.hodLevel + 1,
      },
    });

    let newStatus;

    if (nextStep) {

      await tx.approvalStep.update({
        where: {
          id: nextStep.id,
        },

        data: {
          status: 'PENDING',
        },
      });

      newStatus = 'PENDING_HOD_APPROVAL';

      await tx.fundRequest.update({
        where: { id: requestId },

        data: {
          currentLevel: step.hodLevel + 1,
          status: newStatus,
        },
      });

    } else {

      newStatus = 'PENDING_FINANCE_APPROVAL';

      await tx.fundRequest.update({
        where: { id: requestId },

        data: {
          status: newStatus,
          currentLevel: request.totalHodLevels,
        },
      });
    }

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId: hodUserId,
      actorRole: 'HOD',
      action: 'HOD_APPROVED',
      fromStatus: request.status,
      toStatus: newStatus,
      remarks: remarks || 'Approved by HOD',

      metadata: {
        hodLevel: step.hodLevel,
      },
    });

    return tx.fundRequest.findUnique({
      where: { id: requestId },
    });
  });


  // ─────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────

  const updatedReq = await prisma.fundRequest.findUnique({
    where: { id: requestId },

    include: {
      createdBy: true,
      approvalSteps: true,
    },
  });


  // Notify creator

  await notify(
    updatedReq.createdById,
    requestId,
    'STATUS_UPDATE',
    'Request approved by HOD',
    `Your request "${updatedReq.title}" was approved by HOD.`
  );


  // Notify next HOD

  if (result.status === 'PENDING_HOD_APPROVAL') {

    const nextHOD = updatedReq.approvalSteps.find(
      s => s.status === 'PENDING'
    );

    if (nextHOD) {

      await notify(
        nextHOD.approverId,
        requestId,
        'APPROVAL_REQUIRED',
        'Approval needed',
        `Request "${updatedReq.title}" needs your approval.`
      );
    }
  }


  // Notify Finance

  if (result.status === 'PENDING_FINANCE_APPROVAL') {

    const financeUsers = await prisma.user.findMany({
      where: {
        role: 'FINANCE',
        isActive: true,
      },
    });

    for (const fu of financeUsers) {

      await notify(
        fu.id,
        requestId,
        'FINANCE_REVIEW',
        'New request in queue',
        `"${updatedReq.title}" completed HOD approvals and is ready for finance review.`
      );
    }
  }

  return result;
};


// ─────────────────────────────────────────────────────────
// HOD REJECT
// ─────────────────────────────────────────────────────────

const hodReject = async (requestId, hodUserId, remarks) => {

  const result = await prisma.$transaction(async (tx) => {
    
    if (!remarks?.trim()) throw new Error('Rejection reason is required.');
    const request = await tx.fundRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== 'PENDING_HOD_APPROVAL') {
      throw new Error('Request is not pending HOD approval');
    }

    const step = await tx.approvalStep.findFirst({
      where: {
        fundRequestId: requestId,
        approverId: hodUserId,
        status: 'PENDING',
      },
    });

    if (!step) {
      throw new Error('No pending approval step found for this HOD');
    }

    await tx.approvalStep.update({
      where: { id: step.id },

      data: {
        status: 'REJECTED',
        remarks,
        actionAt: new Date(),
      },
    });

    await tx.fundRequest.update({
      where: { id: requestId },

      data: {
        status: 'NEEDS_REVIEW',
      },
    });

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId: hodUserId,
      actorRole: 'HOD',
      action: 'HOD_REJECTED',
      fromStatus: request.status,
      toStatus: 'NEEDS_REVIEW',
      remarks,

      metadata: {
        hodLevel: step.hodLevel,
      },
    });

    return tx.fundRequest.findUnique({
      where: { id: requestId },
    });
  });


  // Notify creator

  const rejReq = await prisma.fundRequest.findUnique({
    where: { id: requestId },

    include: {
      createdBy: true,
    },
  });

  await notify(
    rejReq.createdById,
    requestId,
    'REQUEST_REJECTED',
    'Request needs revision',
    `Your request "${rejReq.title}" was rejected by HOD. Please review and resubmit.`
  );

  return result;
};


// ─────────────────────────────────────────────────────────
// FINANCE APPROVE
// ─────────────────────────────────────────────────────────

const financeApprove = async (requestId, financeUserId, remarks) => {
  if (!remarks?.trim()) throw new Error('Remarks are required for approval.');
  const result = await prisma.$transaction(async (tx) => {
    
    const request = await tx.fundRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== 'PENDING_FINANCE_APPROVAL') {
      throw new Error('Request is not pending finance approval');
    }

    await tx.financeReview.create({
      data: {
        fundRequestId: requestId,
        reviewedById: financeUserId,
        action: 'APPROVED',
        remarks,
      },
    });

    await tx.fundRequest.update({
      where: { id: requestId },

      data: {
        status: 'FINANCE_APPROVED',
        completedAt: new Date(),
      },
    });

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId: financeUserId,
      actorRole: 'FINANCE',
      action: 'FINANCE_APPROVED',
      fromStatus: request.status,
      toStatus: 'FINANCE_APPROVED',
      remarks: remarks || 'Approved by Finance',
    });

    return tx.fundRequest.findUnique({
      where: { id: requestId },
    });
  });


  // Notify creator

  const approvedReq = await prisma.fundRequest.findUnique({
    where: { id: requestId },

    include: {
      createdBy: true,
    },
  });

  await notify(
    approvedReq.createdById,
    requestId,
    'REQUEST_APPROVED',
    '🎉 Request fully approved!',
    `Your request "${approvedReq.title}" has been approved by Finance. Payment will be processed.`
  );

  return result;
};


// ─────────────────────────────────────────────────────────
// FINANCE REJECT
// ─────────────────────────────────────────────────────────

const financeReject = async (requestId, financeUserId, remarks) => {

  const result = await prisma.$transaction(async (tx) => {

    const request = await tx.fundRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== 'PENDING_FINANCE_APPROVAL') {
      throw new Error('Request is not pending finance approval');
    }

    await tx.financeReview.create({
      data: {
        fundRequestId: requestId,
        reviewedById: financeUserId,
        action: 'REJECTED',
        remarks,
      },
    });

    await tx.fundRequest.update({
      where: { id: requestId },

      data: {
        status: 'FINANCE_REJECTED',
        completedAt: new Date(),
      },
    });

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId: financeUserId,
      actorRole: 'FINANCE',
      action: 'FINANCE_REJECTED',
      fromStatus: request.status,
      toStatus: 'FINANCE_REJECTED',
      remarks,
    });

    return tx.fundRequest.findUnique({
      where: { id: requestId },
    });
  });


  // Notify creator + approved HODs

  const rejectedReq = await prisma.fundRequest.findUnique({
    where: { id: requestId },

    include: {
      createdBy: true,

      approvalSteps: {
        where: {
          status: 'APPROVED',
        },
      },
    },
  });

  await notify(
    rejectedReq.createdById,
    requestId,
    'REQUEST_REJECTED',
    'Request rejected by Finance',
    `Your request "${rejectedReq.title}" was rejected by Finance: ${remarks}`
  );

  for (const s of rejectedReq.approvalSteps) {

    await notify(
      s.approverId,
      requestId,
      'STATUS_UPDATE',
      'Finance rejected after your approval',
      `"${rejectedReq.title}" was rejected by Finance after your approval.`
    );
  }

  return result;
};


// ─────────────────────────────────────────────────────────
// FINANCE NEEDS REVIEW
// ─────────────────────────────────────────────────────────

const financeNeedsReview = async (requestId, financeUserId, remarks) => {

  const result = await prisma.$transaction(async (tx) => {

    const request = await tx.fundRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.status !== 'PENDING_FINANCE_APPROVAL') {
      throw new Error('Request is not pending finance approval');
    }

    await tx.financeReview.create({
      data: {
        fundRequestId: requestId,
        reviewedById: financeUserId,
        action: 'NEEDS_REVIEW',
        remarks,
      },
    });

    await tx.fundRequest.update({
      where: { id: requestId },

      data: {
        status: 'NEEDS_REVIEW',
      },
    });

    await logHistory(tx, {
      fundRequestId: requestId,
      actorId: financeUserId,
      actorRole: 'FINANCE',
      action: 'MARKED_NEEDS_REVIEW',
      fromStatus: request.status,
      toStatus: 'NEEDS_REVIEW',
      remarks,
    });

    return tx.fundRequest.findUnique({
      where: { id: requestId },
    });
  });


  // Notify creator

  const reviewReq = await prisma.fundRequest.findUnique({
    where: { id: requestId },

    include: {
      createdBy: true,
    },
  });

  await notify(
    reviewReq.createdById,
    requestId,
    'NEEDS_REVIEW',
    'Finance needs more information',
    `Your request "${reviewReq.title}" needs revision: ${remarks}`
  );

  return result;
};


// ─────────────────────────────────────────────────────────

module.exports = {
  submitRequest,
  hodApprove,
  hodReject,
  financeApprove,
  financeReject,
  financeNeedsReview,
  needsHODApproval,
  getHODHierarchy,
};