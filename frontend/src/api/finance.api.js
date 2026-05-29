import api from './axios';

// Pass optional params (dept filter) to dashboard
export const getFinanceDashboard = (params = {}) =>
  api.get('/finance/dashboard', { params });

export const getFinanceQueue          = (params)     => api.get('/finance/queue', { params });
export const getFinanceRequestDetails = (id)         => api.get(`/finance/requests/${id}`);
export const financeApprove    = (id, data) => api.post(`/finance/requests/${id}/approve`,      data);
export const financeReject     = (id, data) => api.post(`/finance/requests/${id}/reject`,       data);
export const financeNeedsReview= (id, data) => api.post(`/finance/requests/${id}/needs-review`, data);