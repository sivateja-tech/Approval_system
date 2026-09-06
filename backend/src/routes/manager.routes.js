// src/routes/manager.routes.js
//
// Changes vs uploaded version:
//   • No new routes — all existing routes unchanged.
//   • ?search query param is now forwarded by the controller (already handled
//     in the updated manager.controller.js — no route change needed here).

const express           = require('express');
const router            = express.Router();
const managerController = require('../controllers/manager.controller');
const { authenticate }  = require('../middleware/auth.middleware');
const { authorize }     = require('../middleware/role.middleware');

router.use(authenticate, authorize('MANAGER'));

router.get('/dashboard',              managerController.dashboard);
router.get('/approvals/pending',      managerController.getPendingApprovals);
router.get('/approvals/history',      managerController.getApprovalHistory);
router.get('/requests/:id',           managerController.getRequestDetails);
router.post('/requests/:id/approve',  managerController.approve);
router.post('/requests/:id/reject',   managerController.reject);

module.exports = router;