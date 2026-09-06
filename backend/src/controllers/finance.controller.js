// src/controllers/finance.controller.js
//
// Changes:
//   • dashboard: now passes `hierarchy` query param as second arg to
//     getFinanceDashboardStats (was silently ignored before).
//   • queue: passes `hierarchy` + `search` query params through to
//     getFinanceQueue (were not wired up before).
//   • getRequestDetails: unchanged.
//   • approve / reject / needsReview: unchanged.

const asyncHandler    = require('../middleware/async.middleware');
const financeService  = require('../services/finance.service');
const workflowService = require('../services/workflow.service');
const requestService  = require('../services/request.service');
const { success }     = require('../utils/response.util');

exports.dashboard = asyncHandler(async (req, res) => {
  const { dept, hierarchy } = req.query; // ← added hierarchy
  const stats = await financeService.getFinanceDashboardStats(
    dept      || null,
    hierarchy || null, // ← was missing before
  );
  return success(res, stats, 'Finance dashboard stats');
});

exports.queue = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, dept, hierarchy, search } = req.query; // ← added hierarchy + search
  const { requests, total } = await financeService.getFinanceQueue(
    Number(page),
    Number(limit),
    status    || null,
    dept      || null,
    hierarchy || null, // ← was missing before
    search    || null, // ← was missing before
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

exports.getRequestDetails = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  await requestService.markViewed(id, 'FINANCE');
  const request = await requestService.getRequestById(id, req.user.id, 'FINANCE');
  return success(res, request, 'Request details');
});

exports.approve = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks?.trim())
    return res.status(400).json({ success: false, message: 'Remarks are required for approval' });
  const result = await workflowService.financeApprove(
    parseInt(req.params.id), req.user.id, remarks,
  );
  return success(res, result, 'Request approved by Finance');
});

exports.reject = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks?.trim())
    return res.status(400).json({ success: false, message: 'Rejection reason is required' });
  const result = await workflowService.financeReject(
    parseInt(req.params.id), req.user.id, remarks,
  );
  return success(res, result, 'Request rejected by Finance');
});

exports.needsReview = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks?.trim())
    return res.status(400).json({ success: false, message: 'Review remarks are required' });
  const result = await workflowService.financeNeedsReview(
    parseInt(req.params.id), req.user.id, remarks,
  );
  return success(res, result, 'Request sent back for review');
});