const express = require('express');
const { isAuthenticated } = require('./auth.middleware');
const {
  validateAuthorizationRequest,
  createAuthorizationCode,
  exchangeCodeForToken,
} = require('../services/oauth.service');

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

      // TODO: Render a consent screen here
      // For now, we will auto-consent for simplicity.
      // In a real app, you would render an HTML page asking the user:
      // "Do you want to allow [client.name] to access your [scope]?"
      // For now, we redirect to a temporary consent handler.
      res.redirect('/api/oauth/consent');

    } catch (error) {
      next(error);
    }
  });

  /**
   * This is a temporary route to simulate user consent.
   * In a real application, this would be a POST from the consent form.
   */
  router.get('/consent', isAuthenticated, async (req, res, next) => {
    try {
      const { client, scope, state, redirect_uri } = req.session.oauth;
      const userId = req.session.user.id;

      const code = await createAuthorizationCode(userId, client.clientId, redirect_uri, scope, prisma);

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set('code', code);
      if (state) {
        callbackUrl.searchParams.set('state', state);
      }

      // Clean up session
      delete req.session.oauth;

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

  return router;
};

module.exports = createOAuthRouter;

