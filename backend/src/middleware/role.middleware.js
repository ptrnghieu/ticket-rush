const { error } = require('../utils/response');

/**
 * Factory that returns a middleware enforcing a required role.
 * Must be used AFTER verifyToken (requires req.user to be set).
 *
 * @param {...string} roles - Allowed roles (e.g. 'admin')
 * @returns {Function} Express middleware
 *
 * Usage:
 *   router.delete('/events/:id', verifyToken, requireRole('admin'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(error('Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json(error('Insufficient permissions'));
    }
    next();
  };
}

module.exports = { requireRole };
