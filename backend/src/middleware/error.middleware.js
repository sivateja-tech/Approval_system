const { error } = require('../utils/response.util');

const errorHandler = (err, req, res, next) => {
  console.error(' Error:', err.message);

  // Prisma unique constraint
  if (err.code === 'P2002') {
    return error(res, `Duplicate entry: ${err.meta?.target?.join(', ')}`, 409);
  }
  // Prisma not found
  if (err.code === 'P2025') {
    return error(res, 'Record not found', 404);
  }
  // Multer file error
  if (err.name === 'MulterError') {
    return error(res, err.message, 400);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  return error(res, message, statusCode);
};

module.exports = errorHandler;