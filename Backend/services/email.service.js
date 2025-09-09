require('dotenv').config();
const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const log = logger();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    log.error(`Email transporter error: ${error.message}, Stack: ${error.stack}`);
  } else {
    log.info(`Email config: host=${process.env.EMAIL_HOST}, port=${process.env.EMAIL_PORT}, user=${process.env.EMAIL_USER}`);
  }
});

/**
 * @description Send email to user
 * @param {string} to Email address
 * @param {string|null} verificationToken Verification token for email verification
 * @param {string|null} totpCode TOTP code for login verification
 * @returns {Promise<string>} Message ID
 */
async function sendEmail(to, verificationToken = null, totpCode = null) {
  try {
    let subject, html;

    log.info(`Sending email to ${to} with verificationToken=${verificationToken}, totpCode=${totpCode}`);

    if (verificationToken) {
      // Load verification success template
      const templatePath = path.join(__dirname, '../templates/email-verification-success.html');
      const template = await fs.readFile(templatePath, 'utf-8');
      html = template
        .replace('{{username}}', to)
        .replace('{{dashboard_link}}', 'http://localhost:3000/dashboard')
        .replace('{{support_link}}', 'http://localhost:3000/support')
        .replace('{{privacy_policy_link}}', 'http://localhost:3000/privacy')
        .replace('{{terms_link}}', 'http://localhost:3000/terms')
        .replace('{{contact_link}}', 'http://localhost:3000/contact');
      subject = 'تم تفعيل حسابك بنجاح - OnePass';
    } else if (totpCode) {
      // Load TOTP template
      const templatePath = path.join(__dirname, '../templates/email-totp.html');
      const template = await fs.readFile(templatePath, 'utf-8');
      html = template
        .replace(/{{totp_code}}/g, totpCode || 'ERROR: TOTP_CODE_NOT_PROVIDED')
        .replace('{{username}}', to)
        .replace('{{privacy_policy_link}}', 'http://localhost:3000/privacy')
        .replace('{{terms_link}}', 'http://localhost:3000/terms')
        .replace('{{contact_link}}', 'http://localhost:3000/contact');
      subject = 'رمز التحقق لتسجيل الدخول - OnePass';
      log.info(`TOTP email content after replacement: ${html.includes(totpCode) ? 'TOTP code included' : 'TOTP code NOT included'}`);
    } else {
      throw new Error('Either verificationToken or totpCode must be provided');
    }

    const info = await transporter.sendMail({
      from: '"OnePass" <creola.wiegand26@ethereal.email>',
      to,
      subject,
      html,
    });

    log.info(`Email sent to ${to}: ${info.messageId}`);
    return info.messageId;
  } catch (error) {
    log.error(`Send email error: ${error.message}, Stack: ${error.stack}`);
    throw error;
  }
}

module.exports = { sendEmail };