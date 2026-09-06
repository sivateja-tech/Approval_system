// src/api/axios.js
//
// Changes:
//   • baseURL reads VITE_API_URL env var with localhost fallback
//   • 401 handler clears both 'token' and 'user' from localStorage
//   • 403 / 422 / 404 passed through to individual callers

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://approval-system-xx2k.onrender.com/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// ── Attach JWT to every request ───────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Global response handling ──────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 — token expired / invalid → wipe storage and redirect to login
    if (
      error.response?.status === 401 &&
      !window.location.pathname.includes('/login')
    ) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    // All other errors (403, 404, 422, 500…) bubble up to the caller
    return Promise.reject(error);
  },
);

export default api;