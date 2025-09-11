const { v4: uuidv4 } = require('uuid');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken'); // You'll need to install this: npm install jsonwebtoken

/**
 * Validates the initial authorization request.
 * @param {object} query - The request query parameters.
 * @param {object} prisma - Prisma client.
 * @param {object} log - Logger.
 * @returns {Promise<object>} The validated client application.
 */
async function validateAuthorizationRequest(query, prisma, log) {
  const { client_id, redirect_uri, response_type, scope, state } = query;

  if (response_type !== 'code') {
    throw { status: 400, message: 'Invalid response_type. Only "code" is supported.', code: 'OAUTH_INVALID_RESPONSE_TYPE' };
  }

  if (!client_id || !redirect_uri) {
    throw { status: 400, message: 'client_id and redirect_uri are required.', code: 'OAUTH_MISSING_PARAMS' };
  }

  const client = await prisma.apiKey.findUnique({ where: { clientId: client_id } });

  if (!client) {
    throw { status: 401, message: 'Invalid client_id.', code: 'OAUTH_INVALID_CLIENT' };
  }

  if (!client.redirectUris.includes(redirect_uri)) {
    log.warn({ client_id, redirect_uri, allowed: client.redirectUris }, 'Mismatched redirect_uri');
    throw { status: 400, message: 'Invalid redirect_uri.', code: 'OAUTH_INVALID_REDIRECT_URI' };
  }

  return { client, scope, state, redirect_uri };
}

/**
 * Creates an authorization code after user consent.
 * @param {number} userId - The ID of the authenticated user.
 * @param {string} clientId - The client ID of the application.
 * @param {string} redirectUri - The redirect URI.
 * @param {string} scope - The granted scopes.
 * @param {object} prisma - Prisma client.
 * @returns {Promise<string>} The generated authorization code.
 */
async function createAuthorizationCode(userId, clientId, redirectUri, scope, prisma) {
  const code = uuidv4();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.authorizationCode.create({
    data: {
      code,
      expiresAt,
      redirectUri,
      scope,
      clientId,
      userId,
    },
  });

  return code;
}

/**
 * Exchanges an authorization code for an access token.
 * @param {object} body - The request body.
 * @param {object} prisma - Prisma client.
 * @param {object} log - Logger.
 * @returns {Promise<object>} An object containing the access token and other details.
 */
async function exchangeCodeForToken(body, prisma, log) {
  const { client_id, client_secret, code, grant_type, redirect_uri } = body;

  if (grant_type !== 'authorization_code') {
    throw { status: 400, message: 'Invalid grant_type.', code: 'OAUTH_INVALID_GRANT_TYPE' };
  }

  const client = await prisma.apiKey.findUnique({ where: { clientId: client_id } });
  if (!client || !(await argon2.verify(client.hashedSecret, client_secret))) {
    throw { status: 401, message: 'Invalid client credentials.', code: 'OAUTH_INVALID_CLIENT_CREDENTIALS' };
  }

  const authCode = await prisma.authorizationCode.findUnique({ where: { code } });

  if (!authCode || authCode.clientId !== client_id || authCode.redirectUri !== redirect_uri) {
    throw { status: 400, message: 'Invalid or mismatched authorization code.', code: 'OAUTH_INVALID_CODE' };
  }

  if (new Date() > authCode.expiresAt) {
    throw { status: 400, message: 'Authorization code expired.', code: 'OAUTH_CODE_EXPIRED' };
  }

  // Delete the code after use to prevent replay attacks
  await prisma.authorizationCode.delete({ where: { id: authCode.id } });

  // Issue JWT access token
  const accessToken = jwt.sign(
    {
      sub: authCode.userId, // Subject (user ID)
      aud: client_id, // Audience (client ID)
      scope: authCode.scope,
    },
    process.env.JWT_SECRET, // Make sure to add JWT_SECRET to your .env file
    { expiresIn: '1h' } // Token expires in 1 hour
  );

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: authCode.scope,
  };
}

module.exports = {
  validateAuthorizationRequest,
  createAuthorizationCode,
  exchangeCodeForToken,
};