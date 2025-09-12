const express = require('express');
const { sendEmail } = require('../services/email.service');
const { validateWebhookSignature } = require('./webhook.middleware');

const createWebhookRouter = (prisma, log) => {
  const router = express.Router();

  /**
   * POST /api/webhooks/email-inbound
   * This endpoint is the target for a third-party email service (like Mailgun).
   * It receives incoming emails, finds the real user, and forwards the email.
   *
   * The payload structure depends on the provider (e.g., Mailgun, SendGrid).
   * We'll assume a common structure for this example:
   * {
   *   "recipient": "random123@onepass.me",
   *   "sender": "sender@example.com",
   *   "subject": "Your order confirmation",
   *   "body-html": "<html>...</html>",
   *   "body-plain": "Your order..."
   * }
   */
  router.post('/email-inbound', validateWebhookSignature, async (req, res) => {
    try {
      // The request body is parsed by express.json()
      // The raw body is available at req.rawBody if needed, but signature is already verified.
      const { recipient, sender, subject, 'body-html': bodyHtml, 'body-plain': bodyPlain } = req.body;      

      if (!recipient || !sender || !subject) {
        log.warn({ body: req.body }, 'Inbound email webhook received with missing fields.');
        return res.status(400).send('Missing required fields.');
      }

      // 1. Find the virtual email in the database
      const virtualEmail = await prisma.virtualEmail.findUnique({
        where: { address: recipient },
        include: { user: true }, // Include the related user to get their real email
      });

      // If no virtual email is found, or it's inactive, or the user doesn't exist, stop processing.
      if (!virtualEmail || !virtualEmail.isActive || !virtualEmail.user) {
        log.info(`Received email for non-existent, inactive, or unlinked virtual address: ${recipient}. Ignoring.`);
        return res.status(200).send('Email address not found or inactive.');
      }

      // NEW: Check if forwarding is disabled for this virtual email
      if (!virtualEmail.isForwardingActive) {
        log.info(`Forwarding is disabled for ${recipient}. Ignoring email from ${sender}.`);
        // Still log the email attempt, but mark it as not forwarded
        prisma.forwardedEmailLog.create({
          data: {
            userId: virtualEmail.userId,
            virtualEmailAddress: recipient,
            senderAddress: sender,
            subject: `(Not Forwarded) ${subject}`,
          },
        }).catch(err => log.error({ err }, 'Failed to create non-forwarded email log.'));
        return res.status(200).send('Forwarding is disabled for this address.');
      }

      // Create a log entry for the forwarded email (fire-and-forget to not slow down the response)
      prisma.forwardedEmailLog.create({
        data: {
          userId: virtualEmail.userId,
          virtualEmailAddress: recipient,
          senderAddress: sender,
          subject: subject,
        },
      }).catch(err => log.error({ err }, 'Failed to create forwarded email log.'));

      // 2. Prepare and forward the email to the user's real email address
      const realEmail = virtualEmail.user.email;
      const forwardSubject = `[OnePass Forward] ${subject}`;
      const forwardHtml = `<blockquote><p><b>From:</b> ${sender}<br><b>To:</b> ${recipient}</p></blockquote><hr>${bodyHtml || `<pre>${bodyPlain}</pre>`}`;

      // Use the existing email service to forward the message
      // We don't await this to respond to the webhook quickly
      sendEmail(realEmail, { isForward: true, subject: forwardSubject, html: forwardHtml }, prisma, log)
        .catch(err => log.error({ err }, `Failed to forward email to ${realEmail}`));

      log.info(`Successfully queued email from ${sender} to be forwarded to user ID ${virtualEmail.userId}`);
      res.status(200).send('Email accepted for forwarding.');

    } catch (error) {
      log.error({ err: error }, 'Error processing inbound email webhook.');
      res.status(500).send('Internal Server Error.');
    }
  });

  return router;
};

module.exports = createWebhookRouter;