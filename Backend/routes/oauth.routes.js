const express = require('express');
const {
  validateAuthorizationRequest,
  createAuthorizationCode,
  exchangeCodeForToken,
  getUserInfo,
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
      const { client, scope, state, redirect_uri } = await validateAuthorizationRequest(req.query, prisma, log);

      // Store client and query params in session to use after consent
      req.session.oauth = {
        client,
        scope,
        state,
        redirect_uri,
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
    if (!req.session.oauth) {
      return next({ status: 400, message: 'No active OAuth flow in session.', code: 'OAUTH_SESSION_EXPIRED' });
    }
    // Send only the necessary, non-sensitive client data
    res.json({
      client: {
        name: req.session.oauth.client.name,
        logoUrl: req.session.oauth.client.logoUrl,
      },
      scope: req.session.oauth.scope,
    });
  });

  /**
   * POST /oauth/consent
   * This endpoint handles the user's decision from the consent screen.
   */
  router.post('/consent', isAuthenticated, async (req, res, next) => {
    try {
      const { client, scope, state, redirect_uri, code_challenge, code_challenge_method } = req.session.oauth;
      const userId = req.session.user.id;
      const { action } = req.body;

      // Clean up session immediately
      delete req.session.oauth;

      const callbackUrl = new URL(redirect_uri);
      if (action === 'allow') {
        const code = await createAuthorizationCode(userId, client.clientId, redirect_uri, scope, code_challenge, code_challenge_method, prisma);
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
      const tokenResponse = await exchangeCodeForToken(req.body, prisma, log);
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
      const clientId = req.jwt.aud;

      const userInfo = await getUserInfo(userId, clientId, prisma, log);
      res.status(200).json(userInfo);
    } catch (error) {
      next(error);
    }
  });
  return router;
};

module.exports = createOAuthRouter;
