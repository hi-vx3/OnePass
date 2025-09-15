const express = require('express');
const { z } = require('zod');
const path = require('path');
const { registerUser, sendVerificationEmail, verifyEmail, requestTOTP, verifyTOTP } = require('../services/auth.service');
const { sendEmail } = require('../services/email.service');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const { rateLimit } = require('express-rate-limit');

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

// --- محدد المعدل لطلبات رمز التحقق ---
const otpRequestLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 دقائق
	max: 7, // 7 طلبات كحد أقصى لكل بريد إلكتروني في النافذة الزمنية
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req, res) => req.body.email, // استخدام البريد الإلكتروني كمفتاح للتقيid
	message: {
		status: 429,
		message: 'You have requested the verification code too many times. Please try again in 10 minutes.',
		code: 'TOO_MANY_REQUESTS',
	},
});

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

router.post('/request-totp', otpRequestLimiter, validate(requestTOTPSchema), async (req, res, next) => {
  try {
    const message = await requestTOTP(req.body.email, prisma, log);
    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-totp', validate(verifyTOTPSchema), async (req, res, next) => {
  try {
    const { user, loginFailed, remainingAttempts, errorMessage, errorCode } = await verifyTOTP(req.body.email, req.body.code, req, prisma, log);

    // --- التعامل مع محاولات تسجيل الدخول الفاشلة ---
    // يجب التحقق من فشل تسجيل الدخول أولاً قبل محاولة إنشاء الجلسة
    if (loginFailed) {
      const ip = req.ip;
      const parser = new UAParser(req.headers['user-agent']);
      const uaResult = parser.getResult();
      const browser = uaResult.browser.name ? `${uaResult.browser.name} ${uaResult.browser.version}` : 'متصفح غير معروف';
      const os = uaResult.os.name ? `${uaResult.os.name} ${uaResult.os.version}` : 'نظام تشغيل غير معروف';
      const friendlyDeviceString = `${browser} على ${os}`;

      // --- إرسال تنبيه أمني فقط عند استنفاد جميع المحاولات ---
      // هذا يمنع إرسال إيميلات مزعجة عند كل خطأ بسيط في الإدخال.
      const isLastAttempt = remainingAttempts === 0;
      if (isLastAttempt) {
        sendEmail(user.email, {
          securityAlertDetails: {
            time: new Date().toLocaleString('en-US'),
            ip: ip,
            device: friendlyDeviceString,
          },
        }, prisma, log).catch(err => log.error({ err, userId: user.id }, 'Failed to send security alert email.'));
      }

      const message = errorMessage || (user.totpCode === null 
        ? 'OTP canceled due to too many failed attempts. Please request a new code.' 
        : `Invalid code. You have ${remainingAttempts} attempts remaining.`);
      const code = errorCode || (remainingAttempts > 0 ? 'INVALID_TOTP' : 'OTP_CANCELLED');
      return next({ status: 400, message, code });
    }

    // Create a session for the user
    req.session.user = {
      id: user.id,
      email: user.email,
    };

    // --- الحصول على تفاصيل الطلب (IP والموقع) ---
    const ip = req.ip;
    const geo = geoip.lookup(ip);
    // بناء نص الموقع، مع التعامل مع حالة عدم العثور على الموقع
    const location = geo ? `${geo.city}, ${geo.country}` : 'Unknown Location';
    
    // --- تحليل userAgent لعرض معلومات واضحة ---
    const parser = new UAParser(req.headers['user-agent']);
    const uaResult = parser.getResult();
    const browser = uaResult.browser.name && uaResult.browser.version ? `${uaResult.browser.name} ${uaResult.browser.version}` : 'Unknown Browser';
    const os = uaResult.os.name && uaResult.os.version ? `${uaResult.os.name} ${uaResult.os.version}` : 'Unknown OS';
    const device = uaResult.device.vendor ? `${uaResult.device.vendor} ${uaResult.device.model}` : 'Unknown Device';
    const friendlyDeviceString = `${browser} على ${os} (${device})`;

    // --- إضافة سجل نشاط ---
    // نسجل هذا الحدث في قاعدة البيانات ليظهر في "آخر التحديثات"
    // هذا الإجراء "أطلق وانسى" (fire-and-forget) لكي لا يؤخر استجابة تسجيل الدخول.
    prisma.activity.create({
      data: {
        userId: user.id,
        type: 'login',
        title: 'Successful Login',
        description: `Logged in from ${location} using ${browser}.`,
        ipAddress: ip,
        userAgent: req.headers['user-agent'], // نحتفظ بالمعلومات الخام للمراجعة
      },
    }).catch(err => log.error({ err }, 'Failed to create login activity log.'));

    // --- إرسال إشعار بالبريد الإلكتروني ---
    sendEmail(user.email, { newLoginDetails: { time: new Date().toLocaleString('en-US'), ip, device: friendlyDeviceString, location } }, prisma, log).catch(err => log.error({ err }, 'Failed to send new login email notification.'));

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