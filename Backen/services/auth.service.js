const { PrismaClient } = require('@prisma/client');
     const { v4: uuidv4 } = require('uuid');
     const speakeasy = require('speakeasy');
     const { sendEmail } = require('./email.service');
     const { logger } = require('../utils/logger');

     const prisma = new PrismaClient();
     const log = logger();

     async function registerUser(email) {
       try {
         const existingUser = await prisma.user.findUnique({ where: { email } });
         if (existingUser) {
           throw { status: 409, message: 'البريد الإلكتروني مسجل بالفعل' };
         }

         const verificationToken = uuidv4();
         await prisma.user.create({
           data: {
             email,
             verificationToken,
             isVerified: false,
           },
         });

         sendEmail(email, verificationToken).catch((error) => {
           log.error(`Failed to send verification email to ${email}: ${error.message}`);
         });

         return 'تم تسجيل المستخدم بنجاح. تم إرسال بريد التفعيل.';
       } catch (error) {
         log.error(`Registration error: ${error.message}, Stack: ${error.stack}`);
         if (error.status) throw error;
         throw { status: 500, message: 'خطأ في الخادم أثناء التسجيل' };
       }
     }

     async function sendVerificationEmail(email) {
       try {
         const user = await prisma.user.findUnique({ where: { email } });
         if (!user) {
           throw { status: 404, message: 'البريد الإلكتروني غير مسجل' };
         }

         await sendEmail(email, user.verificationToken);
         return 'تم إرسال بريد التفعيل بنجاح';
       } catch (error) {
         log.error(`Send verification email error: ${error.message}, Stack: ${error.stack}`);
         if (error.status) throw error;
         throw { status: 500, message: 'خطأ في الخادم أثناء إرسال البريد' };
       }
     }

     async function verifyEmail(token) {
       try {
         const user = await prisma.user.findFirst({ where: { verificationToken: token } });
         if (!user) {
           throw { status: 404, message: 'رمز التفعيل غير صالح أو منتهي الصلاحية' };
         }

         await prisma.user.update({
           where: { id: user.id },
           data: { isVerified: true, verificationToken: null },
         });

         await sendEmail(user.email, null, null);
         return 'تم تفعيل البريد الإلكتروني بنجاح';
       } catch (error) {
         log.error(`Verify email error: ${error.message}, Stack: ${error.stack}`);
         if (error.status) throw error;
         throw { status: 500, message: 'خطأ في الخادم أثناء تفعيل البريد' };
       }
     }

     async function requestTOTP(email) {
       try {
         const user = await prisma.user.findUnique({ where: { email } });
         if (!user) {
           throw { status: 404, message: 'البريد الإلكتروني غير مسجل' };
         }

         // Check if a valid TOTP code already exists
         if (user.totpCode && user.totpExpiresAt && new Date() < user.totpExpiresAt) {
           const remainingSeconds = Math.ceil((user.totpExpiresAt - new Date()) / 1000);
           throw { status: 429, message: `الرجاء الانتظار ${remainingSeconds} ثانية قبل طلب رمز جديد` };
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

         await sendEmail(email, null, totpCode);

         return 'تم إرسال رمز TOTP بنجاح';
       } catch (error) {
         log.error(`Request TOTP error: ${error.message}, Stack: ${error.stack}`);
         if (error.status) throw error;
         throw { status: 500, message: 'خطأ في الخادم أثناء طلب TOTP' };
       }
     }

     async function verifyTOTP(email, code) {
       try {
         const user = await prisma.user.findUnique({ where: { email } });
         if (!user) {
           throw { status: 404, message: 'البريد الإلكتروني غير مسجل' };
         }

         if (!user.totpSecret || !user.totpCode || !user.totpExpiresAt) {
           throw { status: 400, message: 'لا يوجد رمز TOTP صالح' };
         }

         if (new Date() > user.totpExpiresAt) {
           throw { status: 400, message: 'انتهت صلاحية رمز TOTP' };
         }

         const isValid = user.totpCode === code;
         if (!isValid) {
           throw { status: 400, message: 'رمز TOTP غير صحيح' };
         }

         await prisma.user.update({
           where: { id: user.id },
           data: { totpCode: null, totpExpiresAt: null },
         });

         return 'تم التحقق من رمز TOTP بنجاح';
       } catch (error) {
         log.error(`Verify TOTP error: ${error.message}, Stack: ${error.stack}`);
         if (error.status) throw error;
         throw { status: 500, message: 'خطأ في الخادم أثناء التحقق من TOTP' };
       }
     }

     module.exports = { registerUser, sendVerificationEmail, verifyEmail, requestTOTP, verifyTOTP };