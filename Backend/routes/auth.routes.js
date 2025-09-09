const express = require('express');
const { z } = require('zod');
const { registerUser, sendVerificationEmail, verifyEmail, requestTOTP, verifyTOTP } = require('../services/auth.service');

const router = express.Router();

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
      next({ status: 400, message: e.message });
    }
  };
}

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const message = await registerUser(req.body.email);
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

router.post('/send-verification-email', validate(verificationEmailSchema), async (req, res, next) => {
  try {
    const message = await sendVerificationEmail(req.body.email);
    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
});

router.get('/verify', validate(verifySchema), async (req, res, next) => {
  try {
    const message = await verifyEmail(req.query.token);
    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
});

router.post('/request-totp', validate(requestTOTPSchema), async (req, res, next) => {
  try {
    const message = await requestTOTP(req.body.email);
    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-totp', validate(verifyTOTPSchema), async (req, res, next) => {
  try {
    const message = await verifyTOTP(req.body.email, req.body.code);
    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
});

module.exports = router;