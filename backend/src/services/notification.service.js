// src/services/notification.service.js
//
// Changes:
//   • getNotifications: fundRequest include now also fetches `id` and
//     `requestNumber` so NotificationBell can show the request number
//     chip and resolve the correct redirect route without an extra query.

'use strict';

const prisma = require('../config/db');

const createNotification = async ({ userId, fundRequestId, type, title, message }) => {
  return prisma.notification.create({
    data: { userId, fundRequestId, type, title, message },
  });
};

const createBulkNotifications = async (notifications) => {
  return prisma.notification.createMany({ data: notifications });
};

const getNotifications = async (userId, page = 1, limit = 20) => {
  const where = { userId };
  const [notifications, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: {
        // Include id + requestNumber so the frontend can build the redirect URL
        // and display the request number chip without extra API calls.
        fundRequest: {
          select: {
            id:            true,
            requestNumber: true,
            title:         true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip:    (Number(page) - 1) * Number(limit),
      take:    Number(limit),
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { notifications, total, unread };
};

const markAsRead = async (notificationId, userId) => {
  return prisma.notification.update({
    where: { id: notificationId, userId },
    data:  { isRead: true, readAt: new Date() },
  });
};

const markAllAsRead = async (userId) => {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data:  { isRead: true, readAt: new Date() },
  });
};

module.exports = {
  createNotification,
  createBulkNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead,
};