// src/routes/notification.routes.js
//
// Changes vs uploaded version:
//   • read-all route moved BEFORE /:id/read to prevent Express from
//     treating the string "read-all" as an :id param value.
//   • All other routes identical.

const router = require('express').Router();
const ctrl   = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/',            ctrl.list);
// "read-all" must come before /:id/read — otherwise Express matches
// PUT /read-all as /:id = "read-all" and hits the wrong handler.
router.put('/read-all',   ctrl.markAllRead);
router.put('/:id/read',   ctrl.markRead);

module.exports = router;