import api from './axios';
export const getNotifications = (params) => api.get('/notifications', { params });
export const markRead = (id) => api.put(`/notifications/${id}/read`);
export const markAllRead = () => api.put('/notifications/read-all');