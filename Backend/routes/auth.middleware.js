/**
 * Middleware to check if the user is authenticated.
 * An authenticated user has a `user` object in their session.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  // If not authenticated, send a 401 Unauthorized error
  const error = {
    status: 401,
    message: 'Authentication required. Please log in.',
    code: 'AUTH_REQUIRED',
  };
  next(error);
}

module.exports = { isAuthenticated };

