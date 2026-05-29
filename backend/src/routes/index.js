const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/departments', require('./department.routes'));
router.use('/requests', require('./request.routes'));
router.use('/hod', require('./hod.routes'));
router.use('/finance', require('./finance.routes'));
router.use('/requests/:id/comments', require('./comment.routes'));
router.use('/notifications', require('./notification.routes'));

module.exports = router;