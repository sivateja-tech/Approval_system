const asyncHandler = require('../middleware/async.middleware');
const hodService = require('../services/hod.service');
const workflowService = require('../services/workflow.service');
const requestService = require('../services/request.service');
const { success, paginate } = require('../utils/response.util');
const prisma=require('../config/db');

exports.dashboard = asyncHandler(async (req, res) => {
  const stats = await hodService.getHODDashboardStats(req.user.id);
  return success(res, stats, 'HOD Dashboard stats');
});

exports.pendingApprovals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const { steps, total } = await hodService.getPendingApprovals(req.user.id, page, limit);
  return paginate(res, steps, total, page, limit, 'Pending approvals fetched');
});

exports.approvalHistory = asyncHandler(async (req, res) => {
   const { page = 1, limit = 10, filter } = req.query;
  // filter can be 'approved', 'rejected', or undefined
  const result = await hodService.getApprovalHistory(
    req.user.id,
    Number(page),
    Number(limit),
    filter || undefined
  );
  return success(res, result.steps, 'Approval history fetched', 200, result.pagination);
});
exports.getRequestDetails = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);

  // Mark as viewed by this HOD
  await prisma.fundRequest.update({
    where: { id },
    data:  { viewedByHODAt: new Date() },
  }).catch(() => {}); // silent — don't fail if already set

  const request = await requestService.getRequestById(id, req.user.id, req.user.role);
  return success(res, request, 'Request details fetched');
});

exports.approve = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  const request = await workflowService.hodApprove(parseInt(req.params.id), req.user.id, remarks);
  return success(res, request, 'Request approved successfully');
});

exports.reject = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks) throw Object.assign(new Error('Rejection reason is required'), { statusCode: 400 });
  const request = await workflowService.hodReject(parseInt(req.params.id), req.user.id, remarks);
  return success(res, request, 'Request rejected');
});