const { v4: uuidv4 } = require('uuid');
const argon2 = require('argon2');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // You'll need to install this: npm install jsonwebtoken

/**
 * Validates the initial authorization request.
 * @param {object} query - The request query parameters.
 * @param {object} prisma - Prisma client.
 * @param {object} log - Logger.
 * @returns {Promise<object>} The validated client application.
 */
async function validateAuthorizationRequest(query, prisma, log) {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = query;

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

  const allowedUris = client.redirectUris ? client.redirectUris.split(',') : [];
  if (!allowedUris.includes(redirect_uri)) {
    const errorMessage = `Invalid redirect_uri. The provided URI "${redirect_uri}" is not in the list of allowed URIs for this client. Allowed URIs: [${allowedUris.join(', ')}]`;
    log.warn(
      { client_id, provided_uri: redirect_uri, allowed_uris: allowedUris },
      'Mismatched redirect_uri during authorization request'
    );
    throw { status: 400, message: errorMessage, code: 'OAUTH_INVALID_REDIRECT_URI' };
  }

  // --- Scope Validation ---
  // Check if the requested scopes are a subset of the scopes granted to the API key.
  const grantedScopes = client.scopes ? client.scopes.split(',') : [];
  const requestedScopes = scope ? scope.split(' ') : []; // Scopes in the request are space-separated

  if (requestedScopes.length > 0) {
    const hasAllScopes = requestedScopes.every(reqScope => grantedScopes.includes(reqScope));

    if (!hasAllScopes) {
      const missingScopes = requestedScopes.filter(reqScope => !grantedScopes.includes(reqScope));
      const errorMessage = `Insufficient scope. The client is not authorized for the following scope(s): ${missingScopes.join(', ')}`;
      throw { status: 403, message: errorMessage, code: 'OAUTH_INSUFFICIENT_SCOPE' };
    }
  }

  return { client, scope: requestedScopes.join(' '), state, redirect_uri, code_challenge, code_challenge_method };
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
async function createAuthorizationCode(userId, clientId, redirectUri, scope, codeChallenge, codeChallengeMethod, prisma) {
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
      codeChallenge,
      codeChallengeMethod,
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
  const { client_id, client_secret, code, grant_type, redirect_uri, code_verifier } = body;

  if (grant_type !== 'authorization_code') {
    throw { status: 400, message: 'Invalid grant_type.', code: 'OAUTH_INVALID_GRANT_TYPE' };
  }

  const client = await prisma.apiKey.findUnique({ where: { clientId: client_id } });
  if (!client) {
    throw { status: 401, message: 'Invalid client credentials.', code: 'OAUTH_INVALID_CLIENT_CREDENTIALS' };
  }

  // If a client_secret is provided, it MUST be valid. Public clients can omit it.
  if (client_secret && !(await argon2.verify(client.hashedSecret, client_secret))) {
    throw { status: 401, message: 'Invalid client credentials.', code: 'OAUTH_INVALID_CLIENT_CREDENTIALS' };
  }

  const authCode = await prisma.authorizationCode.findUnique({ where: { code } });

  if (!authCode || authCode.clientId !== client_id) {
    throw { status: 400, message: 'Invalid authorization code.', code: 'OAUTH_INVALID_CODE' };
  }

  // Security Enhancement: Verify that the redirect_uri in the token request matches the one from the auth code request.
  if (authCode.redirectUri !== redirect_uri) {
    throw { status: 400, message: 'Mismatched redirect_uri.', code: 'OAUTH_INVALID_REDIRECT_URI' };
  }

  if (new Date() > authCode.expiresAt) {
    throw { status: 400, message: 'Authorization code expired.', code: 'OAUTH_CODE_EXPIRED' };
  }

  // --- PKCE Verification ---
  // This block only runs if a code_challenge was associated with the authorization code.
  // This makes PKCE optional on the server side, allowing non-PKCE flows for development on localhost.
  if (authCode.codeChallenge && authCode.codeChallengeMethod === 'S256') {
    if (!code_verifier) {
      throw { status: 400, message: 'code_verifier is required.', code: 'OAUTH_INVALID_REQUEST' };
    }
    const expectedChallenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    if (expectedChallenge !== authCode.codeChallenge) {
      throw { status: 400, message: 'Invalid code_verifier.', code: 'OAUTH_INVALID_GRANT' };
    }
  }

  // Delete the code after use to prevent replay attacks
  await prisma.authorizationCode.delete({ where: { id: authCode.id } });

  // Link the site to the user's account or update last activity
  try {
    const user = await prisma.user.findUnique({
      where: { id: authCode.userId },
      include: { virtualEmail: true },
    });

    if (user && client) {
      const siteUrl = client.redirectUris.split(',')[0]; // Use the first redirect URI as the site URL
      await prisma.linkedSite.upsert({
        where: {
          // A unique constraint would be better, but for now, we find by userId and clientId
          userId_name: { userId: user.id, name: client.name },
        },
        update: {
          lastActivity: new Date(),
        },
        create: {
          userId: user.id,
          name: client.name,
          url: siteUrl,
          email: user.virtualEmail?.address || 'N/A', // Use virtual email if available
        },
      });
      log.info(`Upserted linked site '${client.name}' for user ID ${user.id}`);
    }
  } catch (upsertError) {
    log.error({ err: upsertError }, 'Failed to upsert linked site during token exchange.');
    // We don't block the login process if this fails.
  }

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

/**
 * Fetches user information based on the access token payload.
 * @param {number} userId - The user ID from the JWT.
 * @param {string} clientId - The client ID from the JWT.
 * @param {object} prisma - Prisma client.
 * @param {object} log - Logger.
 * @returns {Promise<object>} An object containing user information.
 */
async function getUserInfo(userId, clientId, prisma, log) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        virtualEmail: true, // Include the related virtual email
      },
    });

    if (!user) {
      throw { status: 404, message: 'User not found.', code: 'USER_NOT_FOUND' };
    }

    // Construct the user info payload
    const userInfo = {
      sub: user.id, // 'sub' (subject) is the standard claim for user ID
      username: user.username || user.email.split('@')[0], // Use username, or fallback to part of the email
      email: user.virtualEmail ? user.virtualEmail.address : null, // The "fake" email
      email_verified: user.isVerified,
      created_at: user.createdAt.toISOString(),
    };

    log.info({ userId, clientId }, 'Successfully fetched user info for client');
    return userInfo;

  } catch (error) {
    log.error({ err: error, userId, clientId }, 'Error fetching user info');
    if (error.status) throw error;
    throw {
      status: 500,
      message: 'Server error while fetching user information',
      code: 'USER_INFO_ERROR',
    };
  }
}

module.exports = {
  validateAuthorizationRequest,
  createAuthorizationCode,
  exchangeCodeForToken,
  getUserInfo,
};