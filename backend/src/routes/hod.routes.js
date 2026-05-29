const router = require('express').Router();
const ctrl = require('../controllers/hod.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);
router.use(authorize('HOD'));

router.get('/dashboard', ctrl.dashboard);
router.get('/approvals/pending', ctrl.pendingApprovals);
router.get('/approvals/history', ctrl.approvalHistory);
router.get('/requests/:id', ctrl.getRequestDetails);
router.post('/requests/:id/approve', ctrl.approve);
router.post('/requests/:id/reject', ctrl.reject);

module.exports = router;