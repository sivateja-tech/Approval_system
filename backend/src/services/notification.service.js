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
      include: { fundRequest: { select: { requestNumber: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit, 
      take: Number(limit),
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { notifications, total, unread };
};

const markAsRead = async (notificationId, userId) => {
  return prisma.notification.update({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });
};

const markAllAsRead = async (userId) => {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
};

module.exports = { createNotification, createBulkNotifications, getNotifications, markAsRead, markAllAsRead };