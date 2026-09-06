// auth.api.js
import api from './axios';

export const requestOTP = (email) =>
  api.post('/auth/otp/request', { email });

export const verifyOTP = (email, otp) =>
  api.post('/auth/otp/verify', { email, otp });

export const getCurrentUser = () =>
  api.get('/auth/me');