const express = require('express');
const {
  validateAuthorizationRequest,
  createAuthorizationCode,
  exchangeCodeForToken,
  getUserInfo,
  createCodeChallenge,
  ALLOWED_SCOPES, // Import the allowed scopes with their descriptions
} = require('../services/oauth.service');
const { isAuthenticated, verifyAccessToken } = require('./auth.middleware');
const path = require('path');

const createOAuthRouter = (prisma, log) => {
  const router = express.Router();

  /**
   * GET /oauth/authorize
   * This is the endpoint where third-party applications will redirect users.
   * It requires the user to be logged in.
   */
  router.get('/authorize', isAuthenticated, async (req, res, next) => {
    try {
      // The service now handles state and PKCE generation and stores them in the session
      const {
        client,
        scope,
        redirect_uri,
        state, // Capture the state from the request
        code_challenge,
        code_challenge_method
      } = await validateAuthorizationRequest(req.query, req.session, prisma, log);

      // Store client and query params in session to use after consent
      req.session.oauth = {
        ...req.session.oauth, // Keep the server-generated state and verifier
        client,
        scope,
        redirect_uri,
        state, // Store the original state in the session
        code_challenge, // Store PKCE challenge
        code_challenge_method, // Store PKCE method
      };
      // Render the consent screen
      res.sendFile(path.join(__dirname, '../templates/consent.html'));
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /oauth/consent-details
   * An internal API endpoint for the consent page to fetch details about the client app.
   */
  router.get('/consent-details', isAuthenticated, (req, res, next) => {
    if (!req.session.oauth || !req.session.oauth.client) {
      return next({ status: 400, message: 'No active OAuth flow in session.', code: 'OAUTH_SESSION_EXPIRED' });
    }

    // Split the scope string into an array of scope IDs
    const requestedScopes = req.session.oauth.scope ? req.session.oauth.scope.split(' ') : [];

    // Map the scope IDs to objects containing the ID and its description from our constants file
    const scopeDetails = requestedScopes.map(scopeId => ({
      id: scopeId,
      description: ALLOWED_SCOPES[scopeId] || `صلاحية غير معروفة: ${scopeId}`, // Fallback for safety
    }));

    // Send the structured data to the frontend
    res.json({
      client: {
        name: req.session.oauth.client.name,
        logoUrl: req.session.oauth.client.logoUrl,
      },
      scopes: scopeDetails, // Send the array of objects instead of a simple string
    });
  });

  /**
   * POST /oauth/consent
   * This endpoint handles the user's decision from the consent screen.
   */
  router.post('/consent', isAuthenticated, async (req, res, next) => {
    try {
      // The originally requested scopes are in `req.session.oauth.scope`
      const { client, redirect_uri, state, code_challenge, code_challenge_method } = req.session.oauth;
      const userId = req.session.user.id;
      const { action, approved_scopes } = req.body; // Get approved_scopes from body

      // Clean up session immediately
      delete req.session.oauth;

      const callbackUrl = new URL(redirect_uri);
      if (action === 'allow') {
        // **Crucial change**: Use the approved scopes from the request body.
        // Join the array into a space-separated string.
        const approvedScopeString = (approved_scopes || []).join(' ');
        const code = await createAuthorizationCode(userId, client.clientId, redirect_uri, approvedScopeString, code_challenge, code_challenge_method, prisma);
        callbackUrl.searchParams.set('code', code);
        if (state) callbackUrl.searchParams.set('state', state);
      } else {
        // User denied access
        callbackUrl.searchParams.set('error', 'access_denied');
        if (state) callbackUrl.searchParams.set('state', state);
      }

      res.redirect(callbackUrl.toString());
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /oauth/token
   * This endpoint is called by the third-party application's server
   * to exchange the authorization code for an access token.
   */
  router.post('/token', async (req, res, next) => {
    try {
      const tokenResponse = await exchangeCodeForToken(req.body, req.session, prisma, log);
      res.status(200).json(tokenResponse);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /oauth/userinfo
   * A protected endpoint that third-party apps can call with an access token
   * to get user information.
   */
  // TODO: Implement this endpoint. It will need a middleware to verify the JWT access token.
  router.get('/userinfo', verifyAccessToken, async (req, res, next) => {
    try {
      // The user ID and client ID are available from the decoded JWT
      const userId = req.jwt.sub;
      const grantedScopes = req.jwt.scope;

      // Pass the granted scopes from the token to the service
      const userInfo = await getUserInfo(userId, grantedScopes, prisma, log);
      res.status(200).json(userInfo);
    } catch (error) {
      next(error);
    }
  });
  return router;
};

module.exports = createOAuthRouter;
