const router = require('express').Router();
const ctrl = require('../controllers/finance.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);
router.use(authorize('FINANCE'));

router.get('/dashboard', ctrl.dashboard);
router.get('/queue', ctrl.queue);
router.get('/requests/:id', ctrl.getRequestDetails);
router.post('/requests/:id/approve', ctrl.approve);
router.post('/requests/:id/reject', ctrl.reject);
router.post('/requests/:id/needs-review', ctrl.needsReview);

module.exports = router;