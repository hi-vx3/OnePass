const crypto = require('crypto');

/**
 * Middleware to validate the signature of a webhook request (e.g., from Mailgun).
 * This prevents unauthorized requests to the webhook endpoint.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
function validateWebhookSignature(req, res, next) {
  // Retrieve the signature details from the request headers.
  // These header names are examples from Mailgun. Adjust them for your provider.
  const timestamp = req.headers['x-mailgun-timestamp'];
  const token = req.headers['x-mailgun-token'];
  const signature = req.headers['x-mailgun-signature'];

  // Retrieve the signing key from environment variables.
  const signingKey = process.env.WEBHOOK_SIGNING_KEY;

  if (!timestamp || !token || !signature || !signingKey) {
    return next({
      status: 401,
      message: 'Webhook signature is missing or incomplete.',
      code: 'WEBHOOK_SIGNATURE_MISSING',
    });
  }

  // Verify that the timestamp is not too old to prevent replay attacks.
  // 5 minutes is a reasonable window.
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return next({ status: 401, message: 'Webhook timestamp is too old.', code: 'WEBHOOK_REPLAY_ATTACK' });
  }

  // Construct the signature string.
  const dataToSign = timestamp + token;

  // Calculate the expected signature using HMAC-SHA256.
  const expectedSignature = crypto.createHmac('sha256', signingKey).update(dataToSign).digest('hex');

  // Compare the signatures in a constant-time manner to prevent timing attacks.
  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return next(); // Signature is valid.
  }

  return next({ status: 403, message: 'Invalid webhook signature.', code: 'WEBHOOK_INVALID_SIGNATURE' });
}

module.exports = { validateWebhookSignature };