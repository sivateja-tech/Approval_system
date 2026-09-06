// src/routes/finance.routes.js
//
// Changes vs uploaded version:
//   • No new routes — all existing routes unchanged.
//   • ?hierarchy and ?search query params are now forwarded by the updated
//     finance.controller.js — no route change needed here.

const express           = require('express');
const router            = express.Router();
const financeController = require('../controllers/finance.controller');
const { authenticate }  = require('../middleware/auth.middleware');
const { authorize }     = require('../middleware/role.middleware');

router.use(authenticate, authorize('FINANCE'));

router.get('/dashboard',                   financeController.dashboard);
router.get('/queue',                       financeController.queue);
router.get('/requests/:id',               financeController.getRequestDetails);
router.post('/requests/:id/approve',      financeController.approve);
router.post('/requests/:id/reject',       financeController.reject);
router.post('/requests/:id/needs-review', financeController.needsReview);

module.exports = router;