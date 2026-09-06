// src/api/hod.api.js  (previously called manager.api.js in some references)
//
// Changes vs uploaded version:
//   • CRITICAL BUG FIX — all URLs changed from /hod/* to /manager/*
//     The backend routes are mounted at /api/v1/manager (index.js:
//     router.use('/manager', require('./manager.routes'))).
//     Using /hod/* made every call a 404.
//   • Renamed getHODDashboard      → getManagerDashboard      (clearer)
//   • Renamed getHODRequestDetails → getManagerRequestDetails (clearer)
//     Old names re-exported as aliases so existing imports don't break.
//   • search param passed through in getPendingApprovals + getApprovalHistory

import api from './axios';

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getManagerDashboard = () =>
  api.get('/manager/dashboard');

// ── Pending approvals queue ───────────────────────────────────────────────────
// params: { page, limit, search }
export const getPendingApprovals = (params) =>
  api.get('/manager/approvals/pending', { params });

// ── Approval history ──────────────────────────────────────────────────────────
// params: { page, limit, filter, search }
// filter: 'approved' | 'rejected' | 'skipped'
export const getApprovalHistory = (params) =>
  api.get('/manager/approvals/history', { params });

// ── Single request detail (manager view) ─────────────────────────────────────
// Marks request as viewed (edit-lock) and returns canAct + myCurrentStep
export const getManagerRequestDetails = (id) =>
  api.get(`/manager/requests/${id}`);

// ── Approval actions ──────────────────────────────────────────────────────────
export const approveRequest = (id, data) =>
  api.post(`/manager/requests/${id}/approve`, data);

export const rejectRequest = (id, data) =>
  api.post(`/manager/requests/${id}/reject`, data);

// ── Backwards-compatible aliases (keep old names working) ─────────────────────
export const getHODDashboard      = getManagerDashboard;
export const getHODRequestDetails = getManagerRequestDetails;