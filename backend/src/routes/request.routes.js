// src/routes/request.routes.js

const express           = require('express');
const router            = express.Router();
const requestController = require('../controllers/request.controller');
const { authenticate }  = require('../middleware/auth.middleware');
const upload            = require('../middleware/upload.middleware');

router.use(authenticate);

// ── Dashboard & list ──────────────────────────────────────────────────────────
router.get('/dashboard', requestController.dashboard);
// Returns approvalLimit + maxApprovableLimit for the logged-in user.
// Used by CreateRequest and EditRequest to validate amounts client-side.
router.get('/my-limits', requestController.getMyLimits);
router.get('/',          requestController.getMyRequests);

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', upload.array('attachments', 10), requestController.create);

// ── Sub-resource + action routes (MUST come before generic /:id) ──────────────
// Req 9: pre-flight check — returns { blocked, reason, maxApprovableLimit }
router.get('/:id/validate-submission',  requestController.validateSubmission);
// Returns exact min/max range for editing a specific request's amount
router.get('/:id/edit-limits',          requestController.getRequestEditLimits);

// Attachment management
// GET    /requests/:id/attachments              — list all attachments
// POST   /requests/:id/attachments              — upload new files
// DELETE /requests/:id/attachments/:attachmentId — soft-delete one file
router.get('/:id/attachments',
  requestController.getAttachments);
router.post('/:id/attachments',
  upload.array('attachments', 10), requestController.addAttachments);
router.delete('/:id/attachments/:attachmentId',
  requestController.deleteAttachment);

// Workflow actions
router.post('/:id/submit',      requestController.submit);
router.post('/:id/cancel',      requestController.cancel);
router.post('/:id/mark-viewed', requestController.markViewed);

// ── Generic single-resource routes (MUST come last) ───────────────────────────
router.get('/:id',  requestController.getById);
router.put('/:id',  upload.array('attachments', 10), requestController.update);

module.exports = router;