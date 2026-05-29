const crypto = require('crypto');

/**
 * Generate a 6-digit numeric OTP
 */
const generateOTP = () => {
  // Cryptographically secure random number
  const buffer = crypto.randomBytes(3); // 3 bytes = 0 to 16777215
  const num = buffer.readUIntBE(0, 3) % 1000000; // limit to 6 digits
  return String(num).padStart(6, '0'); // always 6 digits e.g. "042891"
};

/**
 * Calculate OTP expiry time
 */
const getOTPExpiry = () => {
  const minutes = parseInt(process.env.OTP_EXPIRES_MINUTES) || 10;
  return new Date(Date.now() + minutes * 60 * 1000);
};

module.exports = { generateOTP, getOTPExpiry }; 