const { error } = require('../utils/response.util');

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return error(res, 'Access denied. Insufficient permissions.', 403);
    }
    next();
  };
};

module.exports = { authorize };