const router = require('express').Router();
const {
  requestOTP,
  verifyOTP,
  register,
  login,
  getCurrentUser,
  updateProfile
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../validators/request.validators');
router.post(
  '/otp/request',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    validate,
  ],
  requestOTP
);
router.post(
  '/otp/verify',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('otp')
      .notEmpty().withMessage('OTP is required')
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
      .isNumeric().withMessage('OTP must be numeric'),
    validate,
  ],
  verifyOTP
);
router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty(),
    validate,
  ],
  login
);
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  body('departmentId').isInt({ min: 1 }).withMessage('Department required'),
  validate,
], register);

router.put('/profile', authenticate, [
  body('name').optional().trim().notEmpty(),
  body('currentPassword').optional(),
  body('newPassword').optional().isLength({ min: 6 }),
  validate,
], updateProfile);
router.get('/me', authenticate, getCurrentUser);

module.exports = router;