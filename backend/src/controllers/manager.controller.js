// src/controllers/manager.controller.js
//
// Changes:
//   • getPendingApprovals: passes `search` query param through to service.
//   • getApprovalHistory: passes `search` query param through to service.
//   • All other handlers unchanged.

const asyncHandler    = require('../middleware/async.middleware');
const managerService  = require('../services/manager.service');
const workflowService = require('../services/workflow.service');
const { success }     = require('../utils/response.util');

exports.dashboard = asyncHandler(async (req, res) => {
  const stats = await managerService.getHODDashboardStats(req.user.id);
  return success(res, stats, 'Manager dashboard stats');
});

exports.getPendingApprovals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query; // ← added search
  const result = await managerService.getPendingApprovals(
    req.user.id, Number(page), Number(limit), search || null,
  );
  return res.json({ success: true, data: result.steps, pagination: result.pagination });
});

exports.getApprovalHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, filter, search } = req.query; // ← added search
  const result = await managerService.getApprovalHistory(
    req.user.id, Number(page), Number(limit), filter || null, search || null,
  );
  return res.json({ success: true, data: result.steps, pagination: result.pagination });
});

exports.getRequestDetails = asyncHandler(async (req, res) => {
  const request = await managerService.getManagerRequestDetails(
    parseInt(req.params.id), req.user.id,
  );
  return success(res, request, 'Request details');
});

exports.approve = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks?.trim())
    return res.status(400).json({ success: false, message: 'Remarks are required for approval' });
  const result = await workflowService.managerApprove(
    parseInt(req.params.id), req.user.id, remarks,
  );
  return success(res, result, 'Request approved');
});

exports.reject = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  if (!remarks?.trim())
    return res.status(400).json({ success: false, message: 'Rejection reason is required' });
  const result = await workflowService.managerReject(
    parseInt(req.params.id), req.user.id, remarks,
  );
  return success(res, result, 'Request rejected');
});