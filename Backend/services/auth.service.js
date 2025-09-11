     const { v4: uuidv4 } = require('uuid');
     const speakeasy = require('speakeasy');
     const { sendEmail } = require('./email.service');

     const MAX_TOTP_ATTEMPTS = 5;
     const LOCKOUT_DURATION_MINUTES = 15;

     async function registerUser(email, prisma, log) {
       try {
         const existingUser = await prisma.user.findUnique({ where: { email } });
         if (existingUser) {
           throw { status: 409, message: 'Email is already registered', code: 'AUTH_EMAIL_EXISTS' };
         }

         const verificationToken = uuidv4();
         await prisma.user.create({
           data: {
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

     async function verifyTOTP(email, code, prisma, log) {
       try {
         const user = await prisma.user.findUnique({ where: { email } });
         if (!user) {
           throw { status: 404, message: 'Email not registered', code: 'AUTH_USER_NOT_FOUND' };
         }

         // Check if user is currently locked out
         if (user.totpBlockedUntil && new Date() < user.totpBlockedUntil) {
           const remainingMinutes = Math.ceil((user.totpBlockedUntil - new Date()) / (1000 * 60));
           throw { status: 429, message: `Too many failed attempts. Please try again in ${remainingMinutes} minutes.`, code: 'AUTH_LOCKED_OUT' };
         }

         if (!user.totpSecret || !user.totpCode || !user.totpExpiresAt) {
           throw { status: 400, message: 'No valid TOTP code found', code: 'AUTH_NO_VALID_TOTP' };
         }

         if (new Date() > user.totpExpiresAt) {
           throw { status: 400, message: 'TOTP code has expired', code: 'AUTH_TOTP_EXPIRED' };
         }

         const isValid = user.totpCode === code;
         if (!isValid) {
           const newAttempts = user.totpLoginAttempts + 1;
           let updateData = { totpLoginAttempts: newAttempts };

           if (newAttempts >= MAX_TOTP_ATTEMPTS) {
             const blockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
             updateData = {
               ...updateData,
               totpBlockedUntil: blockedUntil,
               totpLoginAttempts: 0, // Reset attempts after locking
             };
             log.warn({ email }, `User locked out for ${LOCKOUT_DURATION_MINUTES} minutes due to too many failed TOTP attempts.`);
           }

           await prisma.user.update({ where: { id: user.id }, data: updateData });

           throw { status: 400, message: 'Invalid TOTP code', code: 'AUTH_INVALID_TOTP' };
         }

         // On successful login, reset attempts and lockout
         await prisma.user.update({
           where: { id: user.id },
           data: { totpCode: null, totpExpiresAt: null, totpLoginAttempts: 0, totpBlockedUntil: null },
         });

         // Return a safe user object (without sensitive data)
         return {
           id: user.id,
           email: user.email,
           isVerified: user.isVerified,
         };
       } catch (error) {
         log.error({ err: error }, 'Verify TOTP error');
         if (error.status) throw error;
         throw { status: 500, message: 'Server error during TOTP verification', code: 'SERVER_ERROR' };
       }
     }

     module.exports = { registerUser, sendVerificationEmail, verifyEmail, requestTOTP, verifyTOTP };