const prisma = require('../config/db');
const cleanupExpiredOTPs = async () => {
  try {
    const result = await prisma.oTPToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } }, 
          { isUsed: true },       
        ],
      },
    });
    if (result.count > 0) {
      console.log(` Cleaned up ${result.count} expired OTP records`);
    }
  } catch (err) {
    console.error('OTP cleanup error:', err.message);
  }
};

module.exports = { cleanupExpiredOTPs };