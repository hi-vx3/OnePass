const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
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

  // If the request is an API request (expects JSON), send a 401 error.
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    const error = {
      status: 401,
      message: 'Authentication required. Please log in.',
      code: 'AUTH_REQUIRED',
    };
    return next(error);
  }

  // If it's a browser request, redirect to the login page on the frontend.
  req.session.returnTo = req.originalUrl;
  const loginUrl = new URL('/login', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.redirect(loginUrl.toString());
}

/**
 * Middleware factory to check for required API key scope.
 * This checks for a Bearer token in the Authorization header.
 *
 * @param {string} requiredScope - The scope required to access the route.
 * @returns {function} An Express middleware function.
 */
function requireScope(requiredScope) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next({
        status: 401,
        message: 'Authorization header with Bearer token is required.',
        code: 'AUTH_HEADER_MISSING',
      });
    }

    const clientId = authHeader.split(' ')[1];
    if (!clientId) {
      return next({
        status: 401,
        message: 'API key (clientId) is missing from the token.',
        code: 'API_KEY_MISSING',
      });
    }

    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: { clientId },
      });

      if (!apiKey) {
        return next({ status: 403, message: 'Invalid API Key.', code: 'INVALID_API_KEY' });
      }

      const scopes = apiKey.scopes ? apiKey.scopes.split(',') : [];
      if (!scopes.includes(requiredScope)) {
        return next({ status: 403, message: `Forbidden: This endpoint requires the '${requiredScope}' scope.`, code: 'INSUFFICIENT_SCOPE' });
      }

      // Log the API key usage (fire-and-forget)
      prisma.apiKey.update({
        where: { id: apiKey.id },
        data: {
          requestCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      }).catch(err => console.error('Failed to log API key usage:', err)); // Log error but don't block the request

      // Attach the API key and user to the request for further use
      req.apiKey = apiKey;
      req.user = { id: apiKey.userId }; // Simulate a user object for consistency
      next();
    } catch (error) {
      next({ status: 500, message: 'Server error during API key verification.', code: 'API_KEY_VERIFICATION_ERROR' });
    }
  };
}

/**
 * Middleware to verify a JWT access token from the Authorization header.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
function verifyAccessToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next({
      status: 401,
      message: 'Authorization header with Bearer token is required.',
      code: 'AUTH_HEADER_MISSING',
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next({ status: 401, message: 'Token is missing.', code: 'TOKEN_MISSING' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach the decoded payload to the request object
    req.jwt = decoded;
    next();
  } catch (error) {
    // Handle expired or invalid tokens
    const message = error.name === 'TokenExpiredError' ? 'Access token has expired.' : 'Invalid access token.';
    const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return next({ status: 401, message, code });
  }
}

/**
 * Middleware factory to check for a required scope within a JWT access token.
 * This should be used *after* the `verifyAccessToken` middleware.
 *
 * @param {string} requiredScope - The scope required to access the route.
 * @returns {function} An Express middleware function.
 */
function requireTokenScope(requiredScope) {
  return (req, res, next) => {
    // Ensure the JWT payload is available
    if (!req.jwt || !req.jwt.scope) {
      return next({ status: 403, message: 'Forbidden: No scopes present in token.', code: 'NO_SCOPES_IN_TOKEN' });
    }

    const grantedScopes = req.jwt.scope.split(' ');

    if (!grantedScopes.includes(requiredScope)) {
      return next({
        status: 403,
        message: `Forbidden: This endpoint requires the '${requiredScope}' scope.`,
        code: 'INSUFFICIENT_TOKEN_SCOPE',
      });
    }

    next();
  };
}

module.exports = { isAuthenticated, requireScope, verifyAccessToken, requireTokenScope };
