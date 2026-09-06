// src/api/notification.api.js
//
// Changes:
//   • getNotifications: response now carries top-level `unread` count.
//     The NotificationBell component reads response.data.unread for the badge.
//   • No URL changes.

import api from './axios';

// GET /notifications?page=1&limit=20
// Response shape: { data: [...], unread: number, pagination: {...} }
// Each notification may include fundRequest: { id, requestNumber, title }
export const getNotifications = (params) =>
  api.get('/notifications', { params });

// Mark a single notification as read
export const markRead = (id) =>
  api.put(`/notifications/${id}/read`);

// Mark ALL notifications for the current user as read
export const markAllRead = () =>
  api.put('/notifications/read-all');