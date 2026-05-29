const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', ctrl.list);
router.put('/:id/read', ctrl.markRead);
router.put('/read-all', ctrl.markAllRead);

module.exports = router;