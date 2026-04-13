const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

/**
 * Verify the Bearer JWT from the Authorization header.
 * On success sets req.user = { id, email, role }.
 * Returns 401 if token is missing, malformed, or expired.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(error('Authentication token required'));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Token has expired'
      : 'Invalid token';
    return res.status(401).json(error(message));
  }
}

module.exports = { verifyToken };
