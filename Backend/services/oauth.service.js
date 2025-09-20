const { v4: uuidv4 } = require('uuid');
const argon2 = require('argon2');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // You'll need to install this: npm install jsonwebtoken
const { USER_INFO_SCOPES_MAP, ALLOWED_SCOPES } = require('./oauth.constants');
const { sendEventToUser } = require('./sse.service'); // <-- استيراد خدمة SSE

/**
 * Generates a cryptographically secure random string.
 * @param {number} length - The length of the string to generate.
 * @returns {string} A random string.
 */
function generateRandomString(length) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
}

/**
 * Hashes a verifier to create a PKCE code challenge.
 * @param {string} verifier - The code verifier string.
 * @returns {string} The base64-url-encoded SHA-256 hash.
 */
function createCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Validates the initial authorization request.
 * @param {object} query - The request query parameters.
 * @param {object} prisma - Prisma client.
 * @param {object} log - Logger.
 * @returns {Promise<object>} The validated client application.
 */
async function validateAuthorizationRequest(query, session, prisma, log) {
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

  // --- التحقق من صحة Redirect URI ---
  const allowedUris = client.redirectUris ? client.redirectUris.split(',') : [];
  let isRedirectUriValid = allowedUris.includes(redirect_uri);

  // **تحسين:** السماح بـ localhost في بيئة التطوير لتسهيل الاختبار المحلي
  // هذا يجنب المطورين الحاجة إلى إضافة كل منفذ localhost إلى قائمة الروابط المسموح بها.
  if (!isRedirectUriValid && process.env.NODE_ENV !== 'production') {
    try {
      const redirectUrlObject = new URL(redirect_uri);
      if (redirectUrlObject.hostname === 'localhost') {
        isRedirectUriValid = true;
        log.info({ client_id, redirect_uri }, 'Allowed localhost redirect for development environment.');
      }
    } catch (e) {
      // إذا كان الرابط غير صالح، سيفشل التحقق التالي
    }
  }

  if (!isRedirectUriValid) {
    throw { status: 400, message: `Invalid redirect_uri. The provided URI "${redirect_uri}" is not registered for this client.`, code: 'OAUTH_INVALID_REDIRECT_URI' };
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

  // --- Server-Side State and PKCE Management ---
  // The server is now responsible for storing state, nonce, and PKCE challenge from the client.
  const serverState = generateRandomString(32);
  const serverNonce = generateRandomString(32);

  // Store these values in the user's session.
  session.oauth = {
    ...session.oauth, // Preserve existing data like client, scope, etc.
    state: state || serverState, // Use client-side state if provided
    nonce: serverNonce,
  };
  return { client, scope: requestedScopes.join(' '), state: state || serverState, redirect_uri, code_challenge, code_challenge_method };
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
async function exchangeCodeForToken(body, session, prisma, log) {
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
  // PKCE (Proof Key for Code Exchange) validation is critical for public clients.
  if (authCode.codeChallenge) {
    // The client MUST send the code_verifier.
    if (!code_verifier) {
      throw { status: 400, message: 'code_verifier is required for PKCE flow.', code: 'OAUTH_INVALID_GRANT' };
    }
    // The server hashes the received verifier and compares it to the stored challenge.
    const expectedChallenge = createCodeChallenge(code_verifier);
    
    if (expectedChallenge !== authCode.codeChallenge) {
      throw { status: 400, message: 'Invalid code_verifier.', code: 'OAUTH_INVALID_GRANT' };
    }
  }

  // Delete the code after use to prevent replay attacks
  await prisma.authorizationCode.delete({ where: { id: authCode.id } });

  // Clean up the session
  delete session.oauth;

  // Link the site to the user's account or update last activity
  try {
    let wasCreated = false;
    const user = await prisma.user.findUnique({
      where: { id: authCode.userId },
      include: { virtualEmail: true },
    });

    if (user && client) {
      const siteUrl = client.redirectUris.split(',')[0]; // Use the first redirect URI as the site URL

      // Check if the site already exists to determine if it's a new link
      const existingSite = await prisma.linkedSite.findUnique({
        where: { userId_clientId: { userId: user.id, clientId: client.clientId } },
      });
      if (!existingSite) {
        wasCreated = true;
      }

      const linkedSite = await prisma.linkedSite.upsert({
        where: {
          // Now we can use a more reliable unique identifier
          userId_clientId: { userId: user.id, clientId: client.clientId },
        },
        update: {
          lastActivity: new Date(),
        },
        create: {
          clientId: client.clientId,
          userId: user.id,
          name: client.name,
          url: siteUrl,
          email: user.virtualEmail?.address || 'N/A', // Use virtual email if available
        },
      });
      log.info(`Upserted linked site '${client.name}' for user ID ${user.id}`);

      // If a new site was linked, create an activity and send an SSE event
      if (wasCreated) {
        const activity = await prisma.activity.create({
          data: {
            userId: user.id,
            type: 'site_linked',
            title: 'New Site Linked',
            description: `A new site "${client.name}" was linked to your account.`,
            ipAddress: 'N/A', // IP is from the client app's server, not the user's
            userAgent: 'OAuth Flow',
          },
        });
        // Send the event to update the feed and stats
        sendEventToUser(user.id, 'new_notification', { ...activity, feedType: 'activity' });
      }
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
async function getUserInfo(userId, grantedScopes, prisma, log) {
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

    // Dynamically build the user info payload based on granted scopes
    const userInfo = {};
    // Handle the case where grantedScopes is an empty string
    const scopes = grantedScopes ? grantedScopes.split(' ').filter(s => s) : [];

    // Always include default claims
    for (const [claim, valueFn] of Object.entries(USER_INFO_SCOPES_MAP.default)) {
      userInfo[claim] = valueFn(user);
    }

    // Add claims for each granted scope
    for (const scope of scopes) {
      if (USER_INFO_SCOPES_MAP[scope]) {
        for (const [claim, valueFn] of Object.entries(USER_INFO_SCOPES_MAP[scope])) {
          userInfo[claim] = valueFn(user);
        }
      }
    }

    log.info({ userId, scopes: grantedScopes }, 'Successfully fetched user info for client');
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
  createCodeChallenge, // Export the function
  ALLOWED_SCOPES, // Export the scopes object
};