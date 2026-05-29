import api from './axios';

export const getDashboard    = () => api.get('/requests/dashboard');
export const getMyRequests   = (params) => api.get('/requests', { params });
export const getRequestById  = (id) => api.get(`/requests/${id}`);
export const cancelRequest   = (id) => api.post(`/requests/${id}/cancel`);
export const submitRequest   = (id) => api.post(`/requests/${id}/submit`);
export const addComment      = (id, content) =>
  api.post(`/requests/${id}/comments`, { content });

export const createRequest = (data) =>
  api.post('/requests', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateRequest = (id, data) =>
  api.put(`/requests/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });