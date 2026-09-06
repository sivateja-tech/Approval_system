// src/app.js
//
// Changes vs provided version:
//
//   1. AUTHENTICATED FILE SERVING — the bare `express.static('/uploads')`
//      is replaced with a protected route GET /uploads/:filename that checks
//      the JWT, then verifies the requesting user actually has access to the
//      attachment (creator / eligible manager / Finance) before streaming the
//      file. Raw /uploads/* URLs no longer work without a valid token.
//
//   2. UPLOAD DIRECTORY AUTO-CREATE — the uploads/ folder is created on
//      startup if it doesn't exist so Multer never throws ENOENT on first run.
//
//   3. MULTER GLOBAL CONFIG — disk storage, file-size limit (10 MB),
//      allowed MIME types, and a sanitised filename are centralised here so
//      upload.middleware.js just imports the ready-made instance.
//      (If you already have your own upload.middleware.js you can keep it;
//       just make sure it uses the same storage/limits defined below.)
//
//   4. GRACEFUL SHUTDOWN — SIGTERM / SIGINT handlers disconnect Prisma and
//      close the HTTP server cleanly instead of killing mid-request.
//
//   5. UNHANDLED REJECTION / EXCEPTION GUARDS — prevents silent crashes in
//      production.
//
//   6. Everything else (routes, socket.io, OTP cleanup, health check,
//      error handler) is identical to the provided version.

'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const fs         = require('fs');
const multer     = require('multer');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const routes        = require('./routes');
const errorHandler  = require('./middleware/error.middleware');
const socketHandler = require('./sockets/socket.handler');

// ══════════════════════════════════════════════════════════════════════════════
// 1. UPLOAD DIRECTORY — auto-create on startup
// ══════════════════════════════════════════════════════════════════════════════

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('📁 Created uploads/ directory');
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. MULTER CONFIGURATION
//    Exported so upload.middleware.js (and any other place that needs it)
//    can simply do: const upload = require('../config/upload');
//    OR keep your existing upload.middleware.js and replace its internals
//    with this storage + limits config.
// ══════════════════════════════════════════════════════════════════════════════

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    // Sanitise: strip anything that isn't alphanumeric, dot, dash, underscore
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(
      new Error(`File type "${file.mimetype}" is not allowed`),
      { statusCode: 415 },
    ), false);
  }
};

// Exported multer instance — used by upload.middleware.js
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
});

// Make upload available to middleware that imports it
module.exports.upload = upload;

// ══════════════════════════════════════════════════════════════════════════════
// 3. EXPRESS + HTTP SERVER + SOCKET.IO
// ══════════════════════════════════════════════════════════════════════════════

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin:  process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

socketHandler.init(io);

// ══════════════════════════════════════════════════════════════════════════════
// 4. STARTUP JOBS
// ══════════════════════════════════════════════════════════════════════════════

const { cleanupExpiredOTPs }    = require('./jobs/otp.cleanup');
const { verifyEmailConnection } = require('./utils/email.util');

verifyEmailConnection();
setInterval(cleanupExpiredOTPs, 60 * 60 * 1000);
cleanupExpiredOTPs();

// ══════════════════════════════════════════════════════════════════════════════
// 5. GLOBAL MIDDLEWARE
// ══════════════════════════════════════════════════════════════════════════════

app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ══════════════════════════════════════════════════════════════════════════════
// 6. AUTHENTICATED FILE SERVING
//
//    GET /uploads/:filename
//
//    Replaces the old bare express.static('/uploads').
//    Flow:
//      a) Validate JWT (authenticate middleware)
//      b) Look up the Attachment row by fileName
//      c) Check the requesting user has access to the parent FundRequest
//         (creator | eligible manager | Finance)
//      d) Stream the file — or 404 if missing from disk
//
//    This means direct /uploads/xxx.pdf URLs without a token return 401,
//    and tokens belonging to unrelated users return 403.
// ══════════════════════════════════════════════════════════════════════════════

const { authenticate } = require('./middleware/auth.middleware');
const asyncHandler     = require('./middleware/async.middleware');

app.get(
  '/uploads/:filename',
  authenticate,
  asyncHandler(async (req, res) => {
    const { filename } = req.params;
    const userId       = req.user.id;
    const userRole     = req.user.role;

    // Find the attachment record
    const attachment = await prisma.attachment.findFirst({
      where:   { fileName: filename, isDeleted: false },
      include: {
        fundRequest: {
          include: {
            approvalSteps: {
              select: { approverId: true, isEligible: true },
            },
          },
        },
      },
    });

    if (!attachment)
      return res.status(404).json({ success: false, message: 'File not found' });

    const req2 = attachment.fundRequest;

    // Access control — same rules as getRequestById
    const isCreator  = req2.createdById === userId;
    const isApprover = userRole === 'MANAGER' &&
      req2.approvalSteps.some(s => s.approverId === userId && s.isEligible);
    const isFinance  = userRole === 'FINANCE';

    if (!isCreator && !isApprover && !isFinance)
      return res.status(403).json({ success: false, message: 'Access denied' });

    // Stream the file
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ success: false, message: 'File not found on disk' });

    res.setHeader('Content-Disposition', `inline; filename="${attachment.originalName}"`);
    res.setHeader('Content-Type', attachment.fileType);
    return res.sendFile(filePath);
  }),
);

// ══════════════════════════════════════════════════════════════════════════════
// 7. API ROUTES
// ══════════════════════════════════════════════════════════════════════════════

app.use('/api/v1', routes);

// ══════════════════════════════════════════════════════════════════════════════
// 8. HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════════════

app.get('/health', (_req, res) =>
  res.json({ status: 'OK', timestamp: new Date() }),
);

// ══════════════════════════════════════════════════════════════════════════════
// 9. ERROR HANDLER (must be last middleware)
// ══════════════════════════════════════════════════════════════════════════════

app.use(errorHandler);

// ══════════════════════════════════════════════════════════════════════════════
// 10. START SERVER
// ══════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🗄️  Database: MySQL via Prisma`);
  console.log(`📁 Uploads: ${UPLOADS_DIR}`);
});

// ══════════════════════════════════════════════════════════════════════════════
// 11. GRACEFUL SHUTDOWN
// ══════════════════════════════════════════════════════════════════════════════

const shutdown = async (signal) => {
  console.log(`\n${signal} received — shutting down gracefully…`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('✅ HTTP server closed, Prisma disconnected');
    process.exit(0);
  });
  // Force-kill if server hasn't closed within 10 s
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ══════════════════════════════════════════════════════════════════════════════
// 12. UNHANDLED ERRORS — log and exit so the process manager can restart
// ══════════════════════════════════════════════════════════════════════════════

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});