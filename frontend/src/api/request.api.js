// src/api/request.api.js
//
// Changes vs uploaded version:
//   • validateSubmission — NEW (Req 9): pre-flight check before Submit button
//   • addAttachments     — NEW: POST /requests/:id/attachments  (multipart)
//   • deleteAttachment   — NEW: DELETE /requests/:id/attachments/:attachmentId
//   • getAttachments     — NEW: GET  /requests/:id/attachments
//   • markViewed         — NEW: POST /requests/:id/mark-viewed
//   • Removed addComment — no comment model in schema

import api from './axios';

// ── Dashboard & list ──────────────────────────────────────────────────────────
export const getDashboard  = ()       => api.get('/requests/dashboard');
export const getMyRequests = (params) => api.get('/requests', { params });
// Returns { approvalLimit, maxApprovableLimit, hasHierarchy } for the current user.
// Called once on CreateRequest / EditRequest mount for client-side amount validation.
export const getMyLimits   = ()       => api.get('/requests/my-limits');

// ── Single request ────────────────────────────────────────────────────────────
export const getRequestById = (id) => api.get(`/requests/${id}`);

// ── Create / update (multipart — supports file attachments) ──────────────────
export const createRequest = (data) =>
  api.post('/requests', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateRequest = (id, data) =>
  api.put(`/requests/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ── Workflow actions ──────────────────────────────────────────────────────────
export const submitRequest = (id) => api.post(`/requests/${id}/submit`);
export const cancelRequest = (id) => api.post(`/requests/${id}/cancel`);
export const markViewed    = (id) => api.post(`/requests/${id}/mark-viewed`);

// ── Req 9: Pre-submission validation ─────────────────────────────────────────
// Returns { blocked: boolean, reason: string|null, maxApprovableLimit: number|null }
// Call before enabling the Submit button so the UI can warn when no eligible
// approver exists (e.g. requester is highest level but amount exceeds their limit).
export const validateSubmission = (id) =>
  api.get(`/requests/${id}/validate-submission`);

// Returns exact min/max amount range for editing a specific request.
// For DRAFT: any valid amount. For PENDING_*: constrained to active chain ceiling.
export const getEditLimits = (id) =>
  api.get(`/requests/${id}/edit-limits`);

// ── Attachment management ─────────────────────────────────────────────────────
// List all non-deleted attachments for a request
export const getAttachments = (id) =>
  api.get(`/requests/${id}/attachments`);

// Upload one or more new files to an existing request (multipart)
export const addAttachments = (id, data) =>
  api.post(`/requests/${id}/attachments`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Soft-delete a single attachment (creator only, edit-lock applies)
export const deleteAttachment = (requestId, attachmentId) =>
  api.delete(`/requests/${requestId}/attachments/${attachmentId}`);