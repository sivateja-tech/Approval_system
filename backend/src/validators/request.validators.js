const { body, validationResult } = require('express-validator');
const { error } = require('../utils/response.util');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, 'Validation failed', 422, errors.array());
  }
  next();
};

const createRequestRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  body('purpose').optional().trim(),
];

const approveRejectRules = [
  body('remarks').optional().trim().isLength({ max: 1000 }),
];

const rejectRules = [
  body('remarks').trim().notEmpty().withMessage('Rejection reason is required'),
];

module.exports = { validate, createRequestRules, approveRejectRules, rejectRules };