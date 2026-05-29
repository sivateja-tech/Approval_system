require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const routes = require('./routes');
const errorHandler = require('./middleware/error.middleware');
const socketHandler = require('./sockets/socket.handler');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET', 'POST'] },
});

socketHandler.init(io);
const { cleanupExpiredOTPs } = require('./jobs/otp.cleanup');
const { verifyEmailConnection } = require('./utils/email.util');

// Verify email on startup
verifyEmailConnection();

// Run OTP cleanup every hour
setInterval(cleanupExpiredOTPs, 60 * 60 * 1000);
cleanupExpiredOTPs(); // run once on startup too

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/v1', routes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🗄️  Database: MySQL via Prisma`);
});

