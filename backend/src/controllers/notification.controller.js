// src/controllers/notification.controller.js
//
// Changes:
//   • list: response now includes top-level `unread` count so the bell
//     badge can update without a separate API call.
//   • markRead / markAllRead: unchanged.

const asyncHandler        = require('../middleware/async.middleware');
const notificationService = require('../services/notification.service');
const { success }         = require('../utils/response.util');

exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await notificationService.getNotifications(
    req.user.id, Number(page), Number(limit),
  );
  return res.json({
    success: true,
    data:    result.notifications,
    unread:  result.unread,          // ← badge count
    pagination: {
      page:  Number(page),
      limit: Number(limit),
      total: result.total,
      pages: Math.ceil(result.total / Number(limit)),
    },
  });
});

exports.markRead = asyncHandler(async (req, res) => {
  await notificationService.markAsRead(parseInt(req.params.id), req.user.id);
  return success(res, null, 'Notification marked as read');
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  return success(res, null, 'All notifications marked as read');
});