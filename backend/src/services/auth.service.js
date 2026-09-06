const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { generateToken } = require('../utils/jwt.util');
const { generateOTP, getOTPExpiry } = require('../utils/otp.util');
const { sendOTPEmail } = require('../utils/email.util');

const logHistory = async (email, action, userId = null, req = null) => {
  try {
    await prisma.loginHistory.create({
      data: {
        email,
        action,
        userId: userId || null,
        ipAddress: req?.ip || null,
        userAgent: req?.headers?.['user-agent']?.slice(0, 200) || null,
      },
    });
  } catch (e) {
    console.error('History log error:', e.message);
  }
};

const requestOTP = async (email, req = null) => {
  const user = await prisma.user.findUnique({ where: { email }, include: { department: true } });
  
  logHistory(email, 'OTP_REQUEST', user?.id || null, req).catch(console.error);
  
  if (!user || !user.isActive) {
    const err = new Error('Email not registered. Please create an account.');
    err.statusCode = 404;
    throw err;
  }

  await prisma.oTPToken.updateMany({
    where: { userId: user.id, isUsed: false }, data: { isUsed: true },
  });

  const otp = generateOTP();
  const expiresAt = getOTPExpiry();
  
  const hashed = crypto.createHash('sha256').update(otp).digest('hex');
  
  await prisma.oTPToken.create({ data: { userId: user.id, token: hashed, expiresAt } });
  
  sendOTPEmail(user.email, user.name, otp).catch(err => console.error('Email error:', err));
  
  console.log(otp);
  return { message: 'OTP sent successfully.' };
};

const verifyOTP = async (email, otp, req = null) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { department: true, approvalHierarchy: true }, // Updated
  });

  if (!user || !user.isActive) {
    logHistory(email, 'LOGIN_FAILED', null, req).catch(console.error);
    throw new Error('Invalid credentials');
  }

  const otpRecord = await prisma.oTPToken.findFirst({
    where: {
      userId: user.id,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    logHistory(email, 'LOGIN_FAILED', user.id, req).catch(console.error);
    throw new Error('Invalid email or OTP. Please check and try again.'); 
  }

  const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');
  
  if (hashedInput !== otpRecord.token) {
    logHistory(email, 'LOGIN_FAILED', user.id, req).catch(console.error);
    throw new Error('Invalid email or OTP. Please check and try again.');
  }

  await prisma.oTPToken.update({
    where: { id: otpRecord.id },
    data: { isUsed: true },
  });
  
  logHistory(email, 'LOGIN_SUCCESS', user.id, req).catch(console.error);

  const token = generateToken({ userId: user.id, role: user.role });
  const { password: _, ...safe } = user;
  return { token, user: safe };
};

const updateProfile = async (userId, data) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const updateData = {};
  if (data.name) updateData.name = data.name.trim();

  if (data.currentPassword && data.newPassword) {
    const ok = await bcrypt.compare(data.currentPassword, user.password);
    if (!ok) throw new Error('Current password is incorrect');
    updateData.password = await bcrypt.hash(data.newPassword, 10);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    include: { department: true, approvalHierarchy: true }, // Updated
  });

  const { password: _, ...safe } = updated;
  return safe;
};

const getCurrentUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true,
      approvalLimit: true, isActive: true, createdAt: true,
      department: true, approvalHierarchy: true, // Updated
    },
  });
  if (!user) throw new Error('User not found');
  return user;
};

module.exports = { getCurrentUser, requestOTP, verifyOTP, updateProfile };