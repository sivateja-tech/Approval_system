const asyncHandler = require('../middleware/async.middleware');
const financeService = require('../services/finance.service');
const workflowService = require('../services/workflow.service');
const requestService = require('../services/request.service');
const { success, paginate, error } = require('../utils/response.util');
const prisma=require('../config/db');

exports.dashboard = asyncHandler(async (req, res) => {
  const { dept } = req.query;   // optional dept filter
  const stats = await financeService.getFinanceDashboardStats(dept || null);
  return success(res, stats, 'Finance dashboard stats');
});

exports.queue = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const { requests, total } = await financeService.getFinanceQueue(
    Number(page), Number(limit), status || null
  );
  return paginate(res, requests, total, page, limit, 'Finance queue fetched');
});

exports.getRequestDetails = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.fundRequest.update({
    where: { id },
    data:  { viewedByFinanceAt: new Date() },
  }).catch(() => {});
  const request = await requestService.getRequestById(id, req.user.id, req.user.role);
  return success(res, request, 'Request details fetched');
});

exports.approve = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  const request = await workflowService.financeApprove(
    parseInt(req.params.id), req.user.id, remarks
  );
  return success(res, request, 'Request approved by Finance');
});

exports.reject = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks) throw Object.assign(new Error('Rejection reason is required'), { statusCode: 400 });
  const request = await workflowService.financeReject(
    parseInt(req.params.id), req.user.id, remarks
  );
  return success(res, request, 'Request rejected by Finance');
});

exports.needsReview = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks) throw Object.assign(new Error('Review remarks are required'), { statusCode: 400 });
  const request = await workflowService.financeNeedsReview(
    parseInt(req.params.id), req.user.id, remarks
  );
  return success(res, request, 'Request marked as Needs Review');
});