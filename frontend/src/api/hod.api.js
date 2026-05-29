import api from './axios';

export const getHODDashboard     = ()       => api.get('/hod/dashboard');
export const getPendingApprovals = (params) => api.get('/hod/approvals/pending', { params });
export const getApprovalHistory = (params) =>
  api.get('/hod/approvals/history', { params });
export const getHODRequestDetails = (id)   => api.get(`/hod/requests/${id}`);
export const approveRequest      = (id, data) => api.post(`/hod/requests/${id}/approve`, data);
export const rejectRequest       = (id, data) => api.post(`/hod/requests/${id}/reject`, data);