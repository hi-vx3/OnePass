require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function verifyTransporter(log) {
  transporter.verify((error) => {
    if (error) {
      log.error(`Email transporter error: ${error.message}, Stack: ${error.stack}`);
    } else {
      log.info(`Email config: host=${process.env.EMAIL_HOST}, port=${process.env.EMAIL_PORT}, user=${process.env.EMAIL_USER}`);
    }
  });
}

/**
 * @description Send email to user
 * @param {string} to Email address
 * @param {string|null} verificationToken Verification token for email verification
 * @param {string|null} totpCode TOTP code for login verification
 * @param {boolean} isSuccessNotification Flag to send a success notification email
 * @returns {Promise<string>} Message ID
 */
async function sendEmail(to, { verificationToken = null, totpCode = null, isSuccessNotification = false } = {}, prisma, log) {
  try {
    let subject, html;

    log.info(`Sending email to ${to} with params: verificationToken=${!!verificationToken}, totpCode=${!!totpCode}, isSuccessNotification=${isSuccessNotification}`);

    if (verificationToken) {
      // Send the initial verification link email
      const templatePath = path.join(__dirname, '../templates/email-verification.html');
      const template = await fs.readFile(templatePath, 'utf-8');
      const verificationLink = `${process.env.BASE_URL}/api/auth/verify?token=${verificationToken}`;
      html = template
        .replace('{{username}}', to)
        .replace(/{{verification_link}}/g, verificationLink)
        .replace('{{privacy_policy_link}}', 'http://localhost:3001/privacy')
        .replace('{{terms_link}}', 'http://localhost:3001/terms')
        .replace('{{contact_link}}', 'http://localhost:3001/contact');
      subject = 'تفعيل حسابك - OnePass';
    } else if (isSuccessNotification) {
      // Send the "account verified" success email
      const templatePath = path.join(__dirname, '../templates/email-verification-success.html');
      const template = await fs.readFile(templatePath, 'utf-8');
      const dashboardLink = `${process.env.BASE_URL}/dashboard`; // Assuming you have a dashboard page
      html = template
        .replace('{{username}}', to)
        .replace('{{dashboard_link}}', dashboardLink)
        .replace('{{support_link}}', `${process.env.BASE_URL}/support`)
        .replace('{{privacy_policy_link}}', 'http://localhost:3001/privacy')
        .replace('{{terms_link}}', 'http://localhost:3001/terms')
        .replace('{{contact_link}}', 'http://localhost:3001/contact');
      subject = 'تم تفعيل حسابك بنجاح - OnePass';
    } else if (totpCode) {
      // Load TOTP template
      const templatePath = path.join(__dirname, '../templates/email-totp.html');
      const template = await fs.readFile(templatePath, 'utf-8');
      html = template
        .replace(/{{totp_code}}/g, totpCode || 'ERROR: TOTP_CODE_NOT_PROVIDED')
        .replace('{{username}}', to)
        .replace('{{privacy_policy_link}}', 'http://localhost:3001/privacy')
        .replace('{{terms_link}}', 'http://localhost:3001/terms')
        .replace('{{contact_link}}', 'http://localhost:3001/contact');
      subject = 'رمز التحقق لتسجيل الدخول - OnePass';
      log.info(`TOTP email content after replacement: ${html.includes(totpCode) ? 'TOTP code included' : 'TOTP code NOT included'}`);
    } else {
      throw new Error('No email type specified. Provide verificationToken, totpCode, or set isSuccessNotification to true.');
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

module.exports = { sendEmail, verifyTransporter };