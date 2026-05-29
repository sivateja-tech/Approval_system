let io;

const init = (socketIO) => {
  io = socketIO;

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // User joins their personal room
    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined room user_${userId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
};

// Emit notification to specific user
const notifyUser = (userId, event, data) => {
  if (io) io.to(`user_${userId}`).emit(event, data);
};

// Emit to all finance users (join finance room on login)
const notifyFinance = (event, data) => {
  if (io) io.to('finance_room').emit(event, data);
};

module.exports = { init, notifyUser, notifyFinance };