const jwt = require('jsonwebtoken');
const { error } = require('../utils/response.util');
const prisma = require('../config/db');

const authenticate = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  // 1. Check for Bearer token in headers (standard API requests)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 
  // 2. Fallback: Check for token in URL query (for file downloads/image viewing)
  else if (req.query && req.query.token) {
    token = req.query.token;
  }

  // If no token is found in either location, reject
  if (!token) {
    return error(res, 'Authentication required. Please log in.', 401);
  }

  try {
    // 3. Decode the token to get the userId
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 4. Fetch the full user from the database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { department: true, approvalHierarchy: true }, // Uses the new enterprise schema
    });

    if (!user || !user.isActive) {
      return error(res, 'User not found or account is inactive.', 401);
    }

    // 5. Attach the full user object to the request (so req.user.id works!)
    req.user = user; 
    
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token. Please log in again.', 401);
  }
};

module.exports = { authenticate };