const { error } = require('../utils/response.util');

const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${err.message}`);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    return error(res, `Upload error: ${err.message}`, 400);
  }

  // Handle Prisma Database Errors
  if (err.code && err.code.startsWith('P')) {
    return error(res, 'Database operation failed', 400);
  }

  return error(res, message, statusCode);
};

module.exports = errorHandler;