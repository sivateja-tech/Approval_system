// src/api/finance.api.js
//
// Changes vs uploaded version:
//   • getFinanceDashboard — params now explicitly documented:
//     { dept: number, hierarchy: number }
//     Both were accepted by the backend but only dept was being passed
//     from the Finance dashboard component. hierarchy is now wired too.
//   • getFinanceQueue — params documented:
//     { page, limit, status, dept, hierarchy, search }
//   • No URL changes — /finance/* routes are correct.

import api from './axios';

// ── Dashboard stats ───────────────────────────────────────────────────────────
// params: { dept?: number, hierarchy?: number }
export const getFinanceDashboard = (params = {}) =>
  api.get('/finance/dashboard', { params });

// ── Finance queue (list of requests at finance stage) ─────────────────────────
// params: { page?, limit?, status?, dept?, hierarchy?, search? }
// status: 'pending' | 'approved' | 'rejected' | 'review'  (or full enum string)
export const getFinanceQueue = (params) =>
  api.get('/finance/queue', { params });

// ── Single request detail (finance view) ─────────────────────────────────────
// Marks request as viewedByFinanceAt (edit-lock) automatically on the backend
export const getFinanceRequestDetails = (id) =>
  api.get(`/finance/requests/${id}`);

// ── Finance actions ───────────────────────────────────────────────────────────
export const financeApprove     = (id, data) =>
  api.post(`/finance/requests/${id}/approve`, data);

export const financeReject      = (id, data) =>
  api.post(`/finance/requests/${id}/reject`, data);

export const financeNeedsReview = (id, data) =>
  api.post(`/finance/requests/${id}/needs-review`, data);