const { error } = require('../utils/response.util');

/**
 * Authorize users based on their roles.
 * Usage: router.use(authorize('MANAGER', 'FINANCE'))
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return error(res, 'Unauthorized - No role found', 401);
    }

    // If the route allows anyone, or if the user's role is in the allowed list
    if (allowedRoles.includes('ANY') || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return error(res, 'Forbidden - Insufficient permissions', 403);
  };
};

module.exports = { authorize };