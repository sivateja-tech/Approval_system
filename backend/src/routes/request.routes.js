const router = require('express').Router();
const asyncHandler = require('../middleware/async.middleware');
const ctrl = require('../controllers/request.controller');
const prisma=require('../config/db');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const upload = require('../middleware/upload.middleware');
const { createRequestRules, validate } = require('../validators/request.validators');
router.use(authenticate);
router.use(authorize('USER'));
router.get('/dashboard', ctrl.dashboard);
router.post('/', upload.array('attachments', 5), createRequestRules, validate, ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.put('/:id', upload.array('attachments', 5), ctrl.update);
router.post('/:id/submit', ctrl.submit);
router.post('/:id/cancel', ctrl.cancel);
// Add these routes to request.routes.js
router.post('/:id/mark-viewed', authenticate, asyncHandler(async (req, res) => {
  const role = req.user.role;
  const id   = parseInt(req.params.id);
  const data = {};
  if (role === 'HOD')     data.viewedByHODAt     = new Date();
  if (role === 'FINANCE') data.viewedByFinanceAt = new Date();

  if (Object.keys(data).length) {
    await prisma.fundRequest.update({ where: { id }, data });
  }
  return success(res, null, 'Marked as viewed');
}));

module.exports = router;