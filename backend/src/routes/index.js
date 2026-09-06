// src/routes/index.js
//
// Changes vs uploaded version:
//   • Added /departments route — was registered in department.routes.js
//     but never mounted in the index, making GET /departments a 404.

const express = require('express');
const router  = express.Router();

router.use('/auth',          require('./auth.routes'));
router.use('/requests',      require('./request.routes'));
router.use('/manager',       require('./manager.routes'));
router.use('/finance',       require('./finance.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/departments',   require('./department.routes')); // ← was missing

module.exports = router;