     const { v4: uuidv4 } = require('uuid');
     const speakeasy = require('speakeasy');
     const crypto = require('crypto');
     const { sendEmail } = require('./email.service');
     const { sendNotificationToUser } = require('./websocket.service');

     const MAX_TOTP_ATTEMPTS = 5;
     const LOCKOUT_DURATION_MINUTES = 5; // تخفيض مدة الحظر إلى 5 دقائق

     /**
      * Generates a unique, large random number to be used as a public ID.
      * It ensures the number is positive and fits within a 64-bit integer range.
      * @returns {BigInt}
      */
     function generateNumericPublicId() {
       const buffer = crypto.randomBytes(8); // 8 bytes for a 64-bit number
       return buffer.readBigUInt64BE();
     }

     async function registerUser(email, prisma, log) {
       try {
         const existingUser = await prisma.user.findUnique({ where: { email } });
         if (existingUser) {
           throw { status: 409, message: 'Email is already registered', code: 'AUTH_EMAIL_EXISTS' };
         }

         // Generate a unique numeric public ID
         let publicId;
         let isUnique = false;
         while (!isUnique) {
           publicId = generateNumericPublicId();
           const existingId = await prisma.user.findUnique({ where: { publicId: publicId } });
           if (!existingId) {
             isUnique = true;
           }
         }

         const verificationToken = uuidv4();
         await prisma.user.create({
           data: {
             publicId,
             email,
             verificationToken,
             isVerified: false,
           },
         });

         sendEmail(email, { verificationToken }, prisma, log).catch((error) => {
           log.error(`Failed to send verification email to ${email}: ${error.message}`);
         });

         return 'User registered successfully. Verification email sent.';
       } catch (error) {
         log.error({ err: error }, 'Registration error');
         if (error.status) throw error;
         throw { status: 500, message: 'Server error during registration', code: 'SERVER_ERROR' };
       }
     }

     async function sendVerificationEmail(email, prisma, log) {
       try {
         const user = await prisma.user.findUnique({ where: { email } });
         if (!user) {
           throw { status: 404, message: 'Email not registered', code: 'AUTH_USER_NOT_FOUND' };
         }

         await sendEmail(email, { verificationToken: user.verificationToken }, prisma, log);
         return 'Verification email sent successfully.';
       } catch (error) {
         log.error({ err: error }, 'Send verification email error');
         if (error.status) throw error;
         throw { status: 500, message: 'Server error while sending email', code: 'SERVER_ERROR' };
       }
     }

     async function verifyEmail(token, prisma, log) {
       try {
         const user = await prisma.user.findFirst({ where: { verificationToken: token } });
         if (!user) {
           throw { status: 404, message: 'Verification token is invalid or expired', code: 'AUTH_INVALID_TOKEN' };
         }

         await prisma.user.update({
           where: { id: user.id },
           data: { isVerified: true, verificationToken: null },
         });

         // Return the user object on success
         return user;
       } catch (error) {
         log.error({ err: error }, 'Verify email error');
         if (error.status) throw error;
         throw { status: 500, message: 'Server error during email verification', code: 'SERVER_ERROR' };
       }
     }

     async function requestTOTP(email, prisma, log) {
       try {
         const user = await prisma.user.findUnique({ where: { email } });
         if (!user) {
           throw { status: 404, message: 'Email not registered', code: 'AUTH_USER_NOT_FOUND' };
         }

         // Add check to ensure the user is verified before sending TOTP
         if (!user.isVerified) {
           throw { status: 403, message: 'Account must be verified before logging in', code: 'AUTH_NOT_VERIFIED' };
         }

         // Check if a valid TOTP code already exists
         if (user.totpCode && user.totpExpiresAt && new Date() < user.totpExpiresAt) {
           const remainingSeconds = Math.ceil((user.totpExpiresAt - new Date()) / 1000);
           throw { status: 429, message: `Please wait ${remainingSeconds} seconds before requesting a new code`, code: 'AUTH_TOO_MANY_REQUESTS' };
         }

         let totpSecret = user.totpSecret;
         if (!totpSecret) {
           totpSecret = speakeasy.generateSecret({ length: 20 }).base32;
           await prisma.user.update({
             where: { id: user.id },
             data: { totpSecret },
           });
         }

         const totpCode = speakeasy.totp({
           secret: totpSecret,
           encoding: 'base32',
         });

         const totpExpiresAt = new Date(Date.now() + 90 * 1000); // 90 seconds

         await prisma.user.update({
           where: { id: user.id },
           data: { totpCode, totpExpiresAt },
         });

         log.info(`Generated TOTP code: ${totpCode} for ${email}`);

         await sendEmail(email, { totpCode }, prisma, log);

         return 'TOTP code sent successfully.';
       } catch (error) {
         log.error({ err: error }, 'Request TOTP error');
         if (error.status) throw error;
         throw { status: 500, message: 'Server error during TOTP request', code: 'SERVER_ERROR' };
       }
     }

     async function verifyTOTP(email, code, req, prisma, log) { // إضافة req للحصول على IP و userAgent
       try {
         const user = await prisma.user.findUnique({ where: { email } });
         if (!user) {
           throw { status: 404, message: 'Email not registered', code: 'AUTH_USER_NOT_FOUND' };
         }

         // Check if user is currently locked out
         if (user.totpBlockedUntil && new Date() < user.totpBlockedUntil) {
            const remainingMinutes = Math.ceil((user.totpBlockedUntil - new Date()) / (1000 * 60));
            return { user, loginFailed: true, remainingAttempts: 0, errorMessage: `Too many failed attempts. Please try again in ${remainingMinutes} minutes.`, errorCode: 'AUTH_LOCKED_OUT' };
         }

         if (!user.totpSecret || !user.totpCode || !user.totpExpiresAt) {
            return { user, loginFailed: true, remainingAttempts: 0, errorMessage: 'No valid TOTP code found', errorCode: 'AUTH_NO_VALID_TOTP' };
         }

         if (new Date() > user.totpExpiresAt) {
            return { user, loginFailed: true, remainingAttempts: 0, errorMessage: 'TOTP code has expired', errorCode: 'AUTH_TOTP_EXPIRED' };
         }

    const isValid = user.totpCode === code; // Compare the codes

    if (!isValid) {
      // --- Logic for handling a failed attempt ---
      const newAttempts = (user.totpLoginAttempts || 0) + 1;
      let remainingAttempts = MAX_TOTP_ATTEMPTS - newAttempts;

      let updateData = { totpLoginAttempts: newAttempts };

      if (newAttempts >= MAX_TOTP_ATTEMPTS) {
        // إلغاء الرمز بدلاً من الحظر
        updateData = {
          totpCode: null,
          totpExpiresAt: null,
          totpLoginAttempts: 0, // Reset attempts after locking
        };

        // --- Security Notifications on Lockout ---
        const ip = req.ip;
        const userAgent = req.headers['user-agent'] || 'Unknown Device';

        // 1. Create an activity log entry
        prisma.activity.create({
          data: {
            userId: user.id,
            type: 'security_alert',
            title: 'Suspicious Login Attempt',
            description: 'Account has been temporarily locked due to multiple failed login attempts.',
            ipAddress: ip,
            userAgent: userAgent,
          },
        }).catch(err => log.error({ err }, 'Failed to create security alert activity log.'));

        log.warn({ email }, `User exceeded max TOTP attempts. OTP has been cancelled.`);
      }

      // Update the attempt count in the database
      await prisma.user.update({ where: { id: user.id }, data: updateData });
      
      // Return failure status instead of throwing an error
      return { user, loginFailed: true, remainingAttempts };
         }

    // --- Logic for a successful login ---
    // On successful login, reset attempts, lockout, and the code itself
         await prisma.user.update({
           where: { id: user.id },
           data: { totpCode: null, totpExpiresAt: null, totpLoginAttempts: 0, totpBlockedUntil: null },
         });

         // --- إرسال إشعار فوري عبر WebSocket ---
         sendNotificationToUser(user.id, {
           type: 'notification',
           payload: {
             title: 'New Login',
             message: 'A successful login to your account has occurred.',
           }
         });

    // Return a safe user object and success status
         return {
      user: {
        id: user.id,
        email: user.email,
        isVerified: user.isVerified,
      },
      loginFailed: false,
      remainingAttempts: MAX_TOTP_ATTEMPTS,
         };
       } catch (error) {
         log.error({ err: error }, 'Verify TOTP error');
         if (error.status) throw error;
         throw { status: 500, message: 'Server error during TOTP verification', code: 'SERVER_ERROR' };
       }
     }

     module.exports = { registerUser, sendVerificationEmail, verifyEmail, requestTOTP, verifyTOTP };