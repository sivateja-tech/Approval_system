const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: false, 
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
const sendOTPEmail = async (toEmail, userName, otp) => {
  const expiryMinutes = process.env.OTP_EXPIRES_MINUTES || 10;
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: 'Your Login OTP — Fund Request System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1d4ed8; margin-bottom: 8px;">Fund Request System</h2>
        <p style="color: #374151; margin-bottom: 24px;">Hello <strong>${userName}</strong>,</p>

        <p style="color: #374151;">Your one-time login code is:</p>

        <div style="background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px;
                    padding: 24px; text-align: center; margin: 20px 0;">
          <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #1d4ed8;">
            ${otp}
          </span>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          This code expires in <strong>${expiryMinutes} minutes</strong>.
          Do not share it with anyone.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          If you did not request this code, ignore this email.
          Your account is safe.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};


const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email service connected');
  } catch (err) {
    console.warn('⚠️  Email service not configured:', err.message);
  }
};

module.exports = { sendOTPEmail, verifyEmailConnection };