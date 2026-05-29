const asyncHandler = require('../middleware/async.middleware');
const requestService = require('../services/request.service');
const workflowService = require('../services/workflow.service');
const notificationService = require('../services/notification.service');
const { success, paginate, error } = require('../utils/response.util');

exports.create = asyncHandler(async (req, res) => {
  const request = await requestService.createRequest(req.user.id, req.body, req.files || []);
  return success(res, request, 'Request created successfully', 201);
});

exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const { requests, total } = await requestService.getMyRequests(req.user.id, page, limit, status);
  return paginate(res, requests, total, page, limit, 'Requests fetched');
});

exports.getById = asyncHandler(async (req, res) => {
  const request = await requestService.getRequestById(
    parseInt(req.params.id), req.user.id, req.user.role
  );
  return success(res, request, 'Request fetched');
});

exports.update = asyncHandler(async (req, res) => {
  const request = await requestService.updateRequest(
    parseInt(req.params.id), req.user.id, req.body, req.files || []
  );
  return success(res, request, 'Request updated successfully');
});


exports.submit = asyncHandler(async (req, res) => {
  const request = await workflowService.submitRequest(
    parseInt(req.params.id),
    req.user.id
  );
  return success(res, request, 'Request submitted successfully');
});

exports.cancel = asyncHandler(async (req, res) => {
  const request = await requestService.cancelRequest(parseInt(req.params.id), req.user.id);
  return success(res, request, 'Request cancelled');
});

exports.dashboard = asyncHandler(async (req, res) => {
  const stats = await requestService.getDashboardStats(req.user.id);
  return success(res, stats, 'Dashboard stats fetched');
});