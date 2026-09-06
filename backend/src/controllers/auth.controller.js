const asyncHandler = require('../middleware/async.middleware');
const authService = require('../services/auth.service');
const { success, error } = require('../utils/response.util');
exports.requestOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return error(res, 'Email is required', 400);

  const result = await authService.requestOTP(email,req);
  return success(res, null, result.message);
});
exports.verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return error(res, 'Email and OTP are required', 400);

  const result = await authService.verifyOTP(email, otp,req);
  return success(res, result, 'Login successful');
});
exports.updateProfile = asyncHandler(async (req, res) => {
  const result = await authService.updateProfile(req.user.id, req.body);
  return success(res, result, 'Profile updated');
});
exports.getCurrentUser = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  return success(res, user, 'User fetched');
});