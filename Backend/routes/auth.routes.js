const express = require('express');
const { z } = require('zod');
const path = require('path');
const speakeasy = require('speakeasy');
const { isAuthenticated } = require('./auth.middleware');
const { registerUser, sendVerificationEmail, verifyEmail, requestTOTP, verifyTOTP } = require('../services/auth.service');
const { sendEmail } = require('../services/email.service');
const geoip = require('geoip-lite');
const { broadcastToUser } = require('../services/websocket.service');
const UAParser = require('ua-parser-js');
const { rateLimit } = require('express-rate-limit');

const createAuthRouter = (prisma, log, redisClient) => {
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

router.get('/confirm-email-change', validate(verifySchema), async (req, res, next) => {
  try {
    const { token } = req.query;

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user || !user.pendingEmail || new Date() > user.verificationTokenExpiresAt) {
      // إذا لم يتم العثور على المستخدم أو لا يوجد بريد إلكتروني معلق، فالرمز غير صالح
      return res.status(404).sendFile(path.join(__dirname, '../templates/email-verification-failed.html'));
    }

    // تحديث البريد الأساسي ومسح الحقول المؤقتة
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        verificationToken: null,
        verificationTokenExpiresAt: null, // Clear the expiry date
        isVerified: true, // يمكن اعتبار البريد الجديد موثوقاً
      },
    });

    // إرسال إشعار بنجاح العملية
    sendEmail(user.pendingEmail, { isSuccessNotification: true }, prisma, log).catch(err => log.error({ err }, `Failed to send success email to ${user.pendingEmail}`));

    // عرض صفحة النجاح
    res.sendFile(path.join(__dirname, '../templates/email-verified-success.html'));

  } catch (error) {
    log.error({ err: error }, 'Confirm email change error');
    next({ status: 500, message: 'Server error during email change confirmation.', code: 'SERVER_ERROR' });
  }
});

router.post('/request-email-change-code', isAuthenticated, async (req, res, next) => {
  try {
    const userId = Number(req.session.user.id);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return next({ status: 404, message: 'User not found.', code: 'USER_NOT_FOUND' });
    }

    // Generate a new TOTP code and expiry
    const totpCode = speakeasy.totp({ secret: user.totpSecret, encoding: 'base32' });
    const totpExpiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes validity

    await prisma.user.update({
      where: { id: userId },
      data: { totpCode, totpExpiresAt },
    });

    await sendEmail(user.email, { totpCode }, prisma, log);
    res.status(200).json({ message: `A verification code has been sent to your current email: ${user.email}` });
  } catch (error) {
    next({ status: 500, message: 'Failed to send verification code.', code: 'EMAIL_CHANGE_CODE_ERROR' });
  }
});

router.post('/request-totp', otpRequestLimiter, validate(requestTOTPSchema), async (req, res, next) => {
  try {
    const { message, twoFactorType } = await requestTOTP(req.body.email, prisma, log);
    res.status(200).json({ message, twoFactorType });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-totp', validate(verifyTOTPSchema), async (req, res, next) => {
  try {
    const { user, loginFailed, remainingAttempts, errorMessage, errorCode } = await verifyTOTP(req.body.email, req.body.code, req, prisma, log, redisClient);

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

    // --- NEW: Multi-Step Login Logic ---
    const fullUser = await prisma.user.findUnique({ where: { email: req.body.email } });

    if (fullUser.totpSecret) {
      // 2FA is enabled. Do not log in yet.
      // Store partial authentication state in the session.
      req.session.authStep = {
        userId: fullUser.id,
        email: fullUser.email,
        firstFactorPassed: true,
      };
      log.info({ userId: user.id }, 'First login factor (email TOTP) passed. Prompting for 2FA app code.');
      return res.status(200).json({ nextStep: '2fa_app', message: 'Please enter the code from your authenticator app.' });
    }

    // Create a session for the user
    req.session.user = {
      id: fullUser.id,
      email: fullUser.email,
      name: fullUser.name,
      avatarUrl: fullUser.avatarUrl,
      isDeveloper: fullUser.isDeveloper,
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

    res.status(200).json({ message: 'Login successful', user: req.session.user });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-2fa', validate(verifyTOTPSchema), async (req, res, next) => {
  try {
    const { email, code } = req.body;

    // Verify that the first step was completed
    if (!req.session.authStep || !req.session.authStep.firstFactorPassed || req.session.authStep.email !== email) {
      return next({ status: 401, message: 'Invalid authentication flow. Please start over.', code: 'INVALID_AUTH_FLOW' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.totpSecret) {
      return next({ status: 401, message: '2FA is not enabled for this account.', code: '2FA_NOT_ENABLED' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return next({ status: 400, message: 'Invalid 2FA code.', code: 'INVALID_2FA_CODE' });
    }

    // --- Login successful ---
    // Clean up the partial auth state
    delete req.session.authStep;

    // Create the full session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isDeveloper: user.isDeveloper,
    };

    // --- ربط الجلسة بالمستخدم في Redis بعد إتمام المصادقة الثنائية ---
    redisClient.sadd(`user:${user.id}:sessions`, req.sessionID);

    // --- Logging and Notifications (similar to the original flow) ---
    const ip = req.ip;
    const geo = geoip.lookup(ip);
    const location = geo ? `${geo.city}, ${geo.country}` : 'Unknown Location';
    const parser = new UAParser(req.headers['user-agent']);
    const uaResult = parser.getResult();
    const browser = uaResult.browser.name ? `${uaResult.browser.name} ${uaResult.browser.version}` : 'Unknown Browser';
    const os = uaResult.os.name ? `${uaResult.os.name} ${uaResult.os.version}` : 'Unknown OS';
    const friendlyDeviceString = `${browser} على ${os}`;

    prisma.activity.create({
      data: { userId: user.id, type: 'login', title: 'Successful Login', description: `Logged in from ${location} using ${browser}.`, ipAddress: ip, userAgent: req.headers['user-agent'] },
    }).catch(err => log.error({ err }, 'Failed to create login activity log.'));

    sendEmail(user.email, { newLoginDetails: { time: new Date().toLocaleString('en-US'), ip, device: friendlyDeviceString, location } }, prisma, log).catch(err => log.error({ err }, 'Failed to send new login email notification.'));

    res.status(200).json({ message: 'Login successful', user: req.session.user });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-recovery', async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return next({ status: 400, message: 'Email and recovery code are required.', code: 'MISSING_RECOVERY_PARAMS' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { recoveryCodes: { where: { isUsed: false } } },
    });

    if (!user || !user.recoveryCodes || user.recoveryCodes.length === 0) {
      return next({ status: 400, message: 'Invalid recovery code or no codes available.', code: 'INVALID_RECOVERY_CODE' });
    }

    let usedCode = null;
    for (const recoveryCode of user.recoveryCodes) {
      if (await argon2.verify(recoveryCode.hashedCode, code)) {
        usedCode = recoveryCode;
        break;
      }
    }

    if (!usedCode) {
      return next({ status: 400, message: 'Invalid recovery code.', code: 'INVALID_RECOVERY_CODE' });
    }

    // Mark the code as used
    await prisma.recoveryCode.update({
      where: { id: usedCode.id },
      data: { isUsed: true },
    });

    // --- Login successful ---
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isDeveloper: user.isDeveloper,
    };
    redisClient.sadd(`user:${user.id}:sessions`, req.sessionID);

    log.info({ userId: user.id }, 'User logged in successfully using a recovery code.');
    res.status(200).json({ message: 'Login successful', user: req.session.user });

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
  const userId = req.session.user?.id;
  const sessionId = req.sessionID;

  req.session.destroy((err) => {
    if (err) {
      return next({ status: 500, message: 'Could not log out.', code: 'SESSION_DESTROY_ERROR' });
    }

    if (userId && sessionId) {
      // إزالة الجلسة من مجموعة Redis
      redisClient.srem(`user:${userId}:sessions`, sessionId);
      // إعلام الجلسات الأخرى بأن هذه الجلسة قد انتهت
      broadcastToUser(userId, { type: 'session_terminated', payload: { sessionId } });
    }
    res.clearCookie('onepass.sid'); // اسم الكوكي المحدد في app.js
    res.status(200).json({ message: 'Logout successful' });
  });
});

  return router;
};

module.exports = createAuthRouter;