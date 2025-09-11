const express = require('express');
const { z } = require('zod');
const path = require('path');
const { registerUser, sendVerificationEmail, verifyEmail, requestTOTP, verifyTOTP } = require('../services/auth.service');
const { sendEmail } = require('../services/email.service');

const createAuthRouter = (prisma, log) => {
const registerSchema = z.object({
  email: z.string().email(),
});

const verificationEmailSchema = z.object({
  email: z.string().email(),
});

const verifySchema = z.object({
  token: z.string(),
});

const requestTOTPSchema = z.object({
  email: z.string().email(),
});

const verifyTOTPSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Code must be a 6-digit number'),
});

/**
 * @description Middleware for input validation using Zod
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      schema.parse(req.body || req.query);
      next();
    } catch (e) {
      // Format Zod error to be consistent with our custom error structure
      const formattedErrors = e.errors.map(err => err.message).join(', ');
      const error = { status: 400, message: `Invalid input: ${formattedErrors}`, code: 'VALIDATION_ERROR' };
      next(error);
    }
  };
}

const router = express.Router();

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const message = await registerUser(req.body.email, prisma, log);
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

router.post('/send-verification-email', validate(verificationEmailSchema), async (req, res, next) => {
  try {
    const message = await sendVerificationEmail(req.body.email, prisma, log);
    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
});

router.get('/verify', validate(verifySchema), async (req, res, next) => {
  try {
    const user = await verifyEmail(req.query.token, prisma, log);

    // Send a success notification email to the user
    // This is a "fire-and-forget" call, we don't wait for it to complete
    sendEmail(user.email, { isSuccessNotification: true }, prisma, log).catch(err => log.error({ err }, `Failed to send success email to ${user.email}`));

    // Send the success HTML page
    // Note: You can't directly pass `user.email` to a static HTML file this way.
    // For dynamic content, a template engine like EJS or Handlebars would be needed.
    res.sendFile(path.join(__dirname, '../templates/email-verified-success.html'));
  } catch (error) {
    // If the token is invalid or expired (status 404), show a specific failure page
    if (error.status === 404) {
      return res.status(404).sendFile(path.join(__dirname, '../templates/email-verification-failed.html'));
    }
    // For other types of errors, pass to the global error handler
    next(error);
  }
});

router.post('/request-totp', validate(requestTOTPSchema), async (req, res, next) => {
  try {
    const message = await requestTOTP(req.body.email, prisma, log);
    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-totp', validate(verifyTOTPSchema), async (req, res, next) => {
  try {
    const user = await verifyTOTP(req.body.email, req.body.code, prisma, log);

    // Create a session for the user
    req.session.user = {
      id: user.id,
      email: user.email,
    };

    res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    next(error);
  }
});

router.get('/session', (req, res) => {
  if (req.session.user) {
    res.status(200).json({ loggedIn: true, user: req.session.user });
  } else {
    res.status(401).json({ loggedIn: false, message: 'Not authenticated' });
  }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next({ status: 500, message: 'Could not log out.', code: 'SESSION_DESTROY_ERROR' });
    }
    res.clearCookie('connect.sid'); // The default session cookie name
    res.status(200).json({ message: 'Logout successful' });
  });
});

  return router;
};

module.exports = createAuthRouter;