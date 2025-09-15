const express = require('express');
const { isAuthenticated, requireScope, verifyAccessToken, requireTokenScope } = require('./auth.middleware');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getUserInfo } = require('../services/oauth.service');

// Argon2 for hashing client secrets
const argon2 = require('argon2');

const createUserRouter = (prisma, log) => {
  const router = express.Router();

  // --- إعداد Multer لرفع الصور ---
  const avatarUploadPath = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
  // التأكد من وجود مجلد الرفع
  fs.mkdirSync(avatarUploadPath, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, avatarUploadPath);
    },
    filename: (req, file, cb) => {
      const userId = req.session.user.id;
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      cb(null, `avatar-${userId}-${uniqueSuffix}${extension}`);
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Unsupported file type. Please upload an image (jpeg, png, gif).'));
  };

  const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // حد 5 ميجابايت

  // Helper function to generate a secure secret
  const generateClientSecret = () => {
    return `onepass_sk_${uuidv4().replace(/-/g, '')}`;
  };

  // Define Zod schemas for validation
  const apiKeyCreateSchema = z.object({
    name: z.string().min(1, 'Name is required.'),
    redirectUris: z.array(z.string().url()).min(1, 'At least one Redirect URI is required.'),
    logoUrl: z.string().url().optional().or(z.literal('')),
    scopes: z.array(z.string()).optional(),
  });

  const apiKeyUpdateSchema = apiKeyCreateSchema.partial().extend({
    name: z.string().min(1, 'Name is required.'),
    redirectUris: z.array(z.string().url()).min(1, 'At least one Redirect URI is required.'),
  });

  const userProfileUpdateSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters.').max(50, 'Name must not exceed 50 characters.').optional(),
    avatarUrl: z.string().url('Please enter a valid image URL.').optional().or(z.literal('')),
  });


  // This is a protected route.
  // The `isAuthenticated` middleware runs before the route handler.
  // It can be accessed by:
  // 1. A logged-in user via session (isAuthenticated).
  // 2. An API key with the 'read:user' scope (requireScope).
  // 3. A user with a valid JWT access token (verifyAccessToken).
  // We will use verifyAccessToken for OAuth 2.0 flow.
  router.get('/profile', verifyAccessToken, requireTokenScope('read:user'), async (req, res, next) => {
    try {
      // The user ID is now available from the decoded JWT payload
      // The 'sub' from our JWT is the *internal integer ID* of the user.
      const userId = req.jwt.sub; 

      // Ensure userId is a valid number before proceeding.
      const numericUserId = Number(userId);
      if (isNaN(numericUserId)) {
        return next({ status: 400, message: 'Invalid user identifier in token.', code: 'INVALID_TOKEN_SUB' });
      }

      // The granted scopes are also available
      const grantedScopes = req.jwt.scope ? req.jwt.scope.split(' ') : [];

      // The getUserInfo service already handles selecting the correct fields based on scope
      // It expects the internal integer ID to fetch the user record.
      const userInfo = await getUserInfo(numericUserId, grantedScopes.join(' '), prisma, log);
      res.status(200).json(userInfo);
    } catch (error) {
      log.error({ err: error }, 'Error fetching user profile');
      next({ status: 500, message: 'Server error while fetching profile', code: 'SERVER_ERROR' });
    }
  });

  // --- نقاط وصول جديدة للملف الشخصي ---

  // GET /api/user/me - جلب بيانات المستخدم المسجل دخوله
  router.get('/me', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const userWithActivities = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
          // --- جلب آخر 5 أنشطة للمستخدم ---
          activities: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 5,
            select: {
              id: true,
              title: true,
              description: true,
              createdAt: true,
            },
          },
        },
      });

      if (!userWithActivities) {
        return next({ status: 404, message: 'User not found.', code: 'USER_NOT_FOUND' });
      }

      res.status(200).json(userWithActivities);
    } catch (error) {
      next({ status: 500, message: 'Failed to fetch profile data.', code: 'PROFILE_FETCH_ERROR' });
    }
  });

  // PATCH /api/user/me - تحديث بيانات المستخدم
  router.patch('/me', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const validation = userProfileUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return next({ status: 400, message: validation.error.errors.map(e => e.message).join(', '), code: 'VALIDATION_ERROR' });
      }

      const { name, avatarUrl } = validation.data;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { name, avatarUrl },
      });

      // --- إضافة سجل نشاط ---
      prisma.activity.create({
        data: {
          userId,
          type: 'profile_updated',
          title: 'Profile Updated',
          description: 'Profile information (name or avatar) was updated.',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }).catch(err => log.error({ err }, 'Failed to create profile_updated activity log.'));

      res.status(200).json({ success: true, message: 'Profile updated successfully.', user: updatedUser });
    } catch (error) {
      next({ status: 500, message: 'Failed to update profile.', code: 'PROFILE_UPDATE_ERROR' });
    }
  });

  // POST /api/user/me/avatar - نقطة وصول جديدة لرفع الصورة
  router.post('/me/avatar', isAuthenticated, upload.single('avatar'), async (req, res, next) => {
    try {
      if (!req.file) {
        return next({ status: 400, message: 'No file was uploaded.', code: 'FILE_NOT_UPLOADED' });
      }

      const userId = Number(req.session.user.id);
      // بناء المسار الذي سيتم حفظه في قاعدة البيانات ويمكن للواجهة الأمامية استخدامه
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // تحديث المستخدم بالمسار الجديد للصورة
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl },
      });

      // --- إضافة سجل نشاط ---
      prisma.activity.create({
        data: {
          userId,
          type: 'profile_updated',
          title: 'Avatar Updated',
          description: 'The profile avatar was updated.',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }).catch(err => log.error({ err }, 'Failed to create profile_updated activity log.'));

      res.status(200).json({
        success: true,
        message: 'Avatar uploaded successfully.',
        avatarUrl: updatedUser.avatarUrl,
      });
    } catch (error) {
      // معالجة أخطاء multer (مثل حجم الملف أو نوعه)
      if (error instanceof multer.MulterError || error.message.includes('Unsupported file type')) {
        return next({ status: 400, message: error.message, code: 'UPLOAD_VALIDATION_ERROR' });
      }
      next({ status: 500, message: 'Failed to upload avatar.', code: 'AVATAR_UPLOAD_ERROR' });
    }
  });

  // --- Endpoints for Dashboard ---

  // GET /api/user/api-keys
  router.get('/api-keys', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const keys = await prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        // Select only the fields that are safe to send to the client
        select: {
          id: true,
          name: true,
          clientId: true,
          redirectUris: true,
          scopes: true,
          logoUrl: true,
          createdAt: true,
          requestCount: true,
          lastUsedAt: true,
        },
      });
      // Convert redirectUris string back to an array for the frontend
      const formattedKeys = keys.map(key => ({
        ...key,
        redirectUris: key.redirectUris ? key.redirectUris.split(',') : [],
        scopes: key.scopes ? key.scopes.split(',') : [],
      }));
      res.status(200).json(formattedKeys);
    } catch (error) {
      next({ status: 500, message: 'Failed to fetch API keys', code: 'API_KEY_FETCH_ERROR' });
    }
  });

  // POST /api/user/api-keys
  router.post('/api-keys', isAuthenticated, async (req, res, next) => {
    try {
      const validation = apiKeyCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return next({ status: 400, message: validation.error.errors.map(e => e.message).join(', '), code: 'VALIDATION_ERROR' });
      }
      const { name, redirectUris, logoUrl, scopes } = validation.data;

      const userId = Number(req.session.user.id);
      const clientId = `onepass_client_${uuidv4().replace(/-/g, '')}`;
      const clientSecret = generateClientSecret();
      const hashedSecret = await argon2.hash(clientSecret);

      const createdKey = await prisma.apiKey.create({
        data: {
          name,
          clientId,
          clientSecret, // Add the raw secret to be stored
          hashedSecret,
          redirectUris: redirectUris.join(','), // Store as a comma-separated string
          scopes: (scopes || []).join(','), // Store scopes as a comma-separated string
          logoUrl,
          userId,
        },
      });

    // --- إضافة سجل نشاط ---
    prisma.activity.create({
      data: {
        userId,
        type: 'api_key_created',
        title: 'API Key Created',
        description: `A new API key named "${name}" was created.`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    }).catch(err => log.error({ err }, 'Failed to create api_key_created activity log.'));

      // Return the raw secret only once upon creation. Do not store it.
      res.status(201).json({
        ...createdKey,
        clientSecret: clientSecret, // Add the raw secret to the response for one-time display
      });
    } catch (error) {
      log.error({ err: error }, 'Error creating API key');
      next({ status: 500, message: 'Failed to create API key', code: 'API_KEY_CREATE_ERROR' });
    }
  });

  // PATCH /api/user/api-keys/:id
  router.patch('/api-keys/:id', isAuthenticated, async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = Number(req.session.user.id);

      const validation = apiKeyUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return next({ status: 400, message: validation.error.errors.map(e => e.message).join(', '), code: 'VALIDATION_ERROR' });
      }
      const { name, redirectUris, logoUrl, scopes } = validation.data;

      const updatedKey = await prisma.apiKey.update({
        where: { id, userId }, // Ensures user can only update their own keys
        data: {
          name,
          redirectUris: redirectUris.join(','),
          scopes: (scopes || []).join(','),
          logoUrl,
        },
      });

      // --- إضافة سجل نشاط ---
      prisma.activity.create({
        data: {
          userId,
          type: 'api_key_updated',
          title: 'API Key Updated',
          description: `The API key "${name}" was updated.`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }).catch(err => log.error({ err }, 'Failed to create api_key_updated activity log.'));

      // Format the response to be consistent with the GET endpoint
      const formattedKey = {
        ...updatedKey,
        redirectUris: updatedKey.redirectUris.split(','),
        scopes: updatedKey.scopes.split(','),
      };

      res.status(200).json(formattedKey);
    } catch (error) {
      if (error.code === 'P2025') { // Prisma error for record not found
        return next({ status: 404, message: 'API Key not found or you do not have permission to edit it.', code: 'API_KEY_NOT_FOUND' });
      }
      log.error({ err: error }, 'Error updating API key');
      next({ status: 500, message: 'Failed to update API key', code: 'API_KEY_UPDATE_ERROR' });
    }
  });

  // DELETE /api/user/api-keys/:id
  router.delete('/api-keys/:id', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const { id } = req.params;

      // First, find the key to log its name before deleting
      const keyToDelete = await prisma.apiKey.findFirst({
        where: { id, userId },
      });

      await prisma.apiKey.delete({
        where: { id, userId },
      });

      // --- إضافة سجل نشاط ---
      if (keyToDelete) {
        prisma.activity.create({
          data: { userId, type: 'api_key_deleted', title: 'API Key Deleted',
            description: `The API key "${keyToDelete.name}" was deleted.`, ipAddress: req.ip, userAgent: req.headers['user-agent'],
           },
        }).catch(err => log.error({ err }, 'Failed to create api_key_deleted activity log.'));
      }
      res.status(204).send();
    } catch (error) {
      // Handle case where key is not found or doesn't belong to user
      if (error.code === 'P2025') {
        return next({ status: 404, message: 'API Key not found', code: 'API_KEY_NOT_FOUND' });
      }
      next({ status: 500, message: 'Failed to delete API key', code: 'API_KEY_DELETE_ERROR' });
    }
  });

  // GET /api/user/notifications (assuming /api/notifications is user-specific)
  router.get('/notifications', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      res.status(200).json(notifications);
    } catch (error) {
       next({ status: 500, message: 'Failed to fetch notifications', code: 'NOTIFICATION_FETCH_ERROR' });
    }
  });

  // PATCH /api/user/notifications
  router.patch('/notifications', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const { enabled } = req.body;
      await prisma.user.update({
        where: { id: userId },
        data: { notificationsEnabled: !!enabled },
      });

      // --- إضافة سجل نشاط ---
      prisma.activity.create({
        data: {
          userId,
          type: 'settings_updated',
          title: 'Notification Settings Updated',
          description: `Account notifications were ${enabled ? 'enabled' : 'disabled'}.`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }).catch(err => log.error({ err }, 'Failed to create settings_updated activity log.'));
      res.status(200).json({ success: true, message: 'Notification settings updated.' });
    } catch (error) {
      next({ status: 500, message: 'Failed to update notification settings', code: 'NOTIFICATION_UPDATE_ERROR' });
    }
  });

  // PATCH /api/user/virtual-email
  router.patch('/virtual-email', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const { active } = req.body;

      // Find the virtual email and update its status
      await prisma.virtualEmail.update({
        where: { userId },
        data: { isActive: !!active },
      });

      // --- إضافة سجل نشاط ---
      prisma.activity.create({
        data: {
          userId,
          type: 'virtual_email_toggled',
          title: 'Virtual Email Status Changed',
          description: `The virtual email was ${active ? 'activated' : 'deactivated'}.`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }).catch(err => log.error({ err }, 'Failed to create virtual_email_toggled activity log.'));

      log.info(`User ${userId} toggled virtual email to ${active}`);
      res.status(200).json({ success: true, message: 'Virtual email status updated.' });
    } catch (error) {
      // Handle case where virtual email is not found
      if (error.code === 'P2025') {
        return next({ status: 404, message: 'Virtual email not found for this user.', code: 'VIRTUAL_EMAIL_NOT_FOUND' });
      }
      next({ status: 500, message: 'Failed to update virtual email status', code: 'VIRTUAL_EMAIL_ERROR' });
    }
  });

  // PATCH /api/user/virtual-email/forwarding
  router.patch('/virtual-email/forwarding', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const { enabled } = req.body;

      await prisma.virtualEmail.update({
        where: { userId },
        data: { isForwardingActive: !!enabled },
      });

      // --- إضافة سجل نشاط ---
      prisma.activity.create({
        data: {
          userId,
          type: 'forwarding_toggled',
          title: 'Forwarding Status Changed',
          description: `Email forwarding was ${enabled ? 'enabled' : 'disabled'}.`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }).catch(err => log.error({ err }, 'Failed to create forwarding_toggled activity log.'));

      log.info(`User ${userId} toggled email forwarding to ${enabled}`);
      res.status(200).json({ success: true, message: 'Email forwarding status updated.' });
    } catch (error) {
      if (error.code === 'P2025') {
        return next({ status: 404, message: 'Virtual email not found for this user.', code: 'VIRTUAL_EMAIL_NOT_FOUND' });
      }
      next({ status: 500, message: 'Failed to update email forwarding status', code: 'FORWARDING_UPDATE_ERROR' });
    }
  });

  // POST /api/user/virtual-email/generate
  // Creates a new virtual email if one doesn't exist, or activates an existing one.
  router.post('/virtual-email/generate', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);


      // 1. Check if a virtual email already exists for the user
      let virtualEmail = await prisma.virtualEmail.findUnique({
        where: { userId },
      });

      if (virtualEmail) {
        // 2. If it exists, just ensure it's active
        if (!virtualEmail.isActive) {
          virtualEmail = await prisma.virtualEmail.update({
            where: { userId },
            data: { isActive: true },
          });
        }
        log.info(`Activated existing virtual email for user ${userId}`);
        res.status(200).json({ success: true, email: virtualEmail.address, message: 'Virtual email activated.' });
      } else {
        // 3. If it doesn't exist, create a new one
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          return next({ status: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
        }



        const { alias } = req.body;
        let newAddress;

        if (alias) {
          // User wants a custom alias
          const sanitizedAlias = alias.toLowerCase().replace(/[^a-z0-9-]/g, '');
          if (sanitizedAlias.length < 3 || sanitizedAlias.length > 30) {
            return next({ status: 400, message: 'Alias must be between 3 and 30 alphanumeric characters or hyphens.', code: 'INVALID_ALIAS' });
          }

          newAddress = `${sanitizedAlias}@onepass.me`;
          const existing = await prisma.virtualEmail.findUnique({ where: { address: newAddress } });
          if (existing) {
            return next({ status: 409, message: 'This alias is already taken. Please choose another one.', code: 'ALIAS_TAKEN' });
          }
        } else {
          // Generate a completely random and unique address to ensure anonymity.
          const generateRandomString = (length) => {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
              result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
          };

          let isUnique = false;
          while (!isUnique) {
            const randomPart = generateRandomString(12); // Generate a 12-character random string
            newAddress = `${randomPart}@onepass.me`;
            const existing = await prisma.virtualEmail.findUnique({ where: { address: newAddress } });
            if (!existing) {
              isUnique = true;
            }
          }
        }



        virtualEmail = await prisma.virtualEmail.create({
          data: {
            userId,
            address: newAddress,
            canChange: true,
            isActive: true,
          },
        });

        // --- إضافة سجل نشاط ---
        prisma.activity.create({
          data: {
            userId,
            type: 'virtual_email_created',
            title: 'New Virtual Email Created',
            description: `A new virtual email was created and activated: ${virtualEmail.address}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        }).catch(err => log.error({ err }, 'Failed to create virtual_email_created activity log.'));
        log.info(`Generated new virtual email for user ${userId}`);
        res.status(201).json({ success: true, email: virtualEmail.address, message: 'Virtual email created and activated.', aliasUsed: !!alias });
      }
    } catch (error) {
      log.error({ err: error }, 'Error generating or activating virtual email');
      next({ status: 500, message: 'Failed to generate or activate virtual email', code: 'VIRTUAL_EMAIL_GENERATE_ERROR' });
    }
  });


  // POST /api/user/virtual-email/regenerate
  // Deletes the old virtual email and creates a new one.
  router.post('/virtual-email/regenerate', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const { alias } = req.body;

       const virtualEmail = await prisma.virtualEmail.findUnique({
        where: { userId },
      });

       if (!virtualEmail.canChange) {
            return next({ status: 403, message: 'Virtual email can not be changed more than once', code: 'VIRTUAL_EMAIL_CAN_NOT_BE_CHANGED' });
        }
      // Using a transaction to ensure atomicity
      const newVirtualEmail = await prisma.$transaction(async (tx) => {
        // 1. Delete the old virtual email if it exists
        await tx.virtualEmail.deleteMany({
         where: { userId },
        });

        // 2. Generate the new email
        let newAddress;
        if (alias) {
          const sanitizedAlias = alias.toLowerCase().replace(/[^a-z0-9-]/g, '');
          if (sanitizedAlias.length < 3 || sanitizedAlias.length > 30) {
            throw { status: 400, message: 'Alias must be between 3 and 30 alphanumeric characters or hyphens.', code: 'INVALID_ALIAS' };
          }
          newAddress = `${sanitizedAlias}@onepass.me`;
          const existing = await tx.virtualEmail.findUnique({ where: { address: newAddress } });
          if (existing) {
            throw { status: 409, message: 'This alias is already taken. Please choose another one.', code: 'ALIAS_TAKEN' };
          }
        } else {
          const generateRandomString = (length) => {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
              result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
          };
          let isUnique = false;
          while (!isUnique) {
            const randomPart = generateRandomString(12);
            newAddress = `${randomPart}@onepass.me`;
            const existing = await tx.virtualEmail.findUnique({ where: { address: newAddress } });
            if (!existing) isUnique = true;
          }
        }

        // 3. Create the new virtual email record
        return tx.virtualEmail.create({ data: { userId, address: newAddress, isActive: true, canChange: false } });

      });

      // --- إضافة سجل نشاط ---
      prisma.activity.create({
        data: {
          userId,
          type: 'virtual_email_regenerated',
          title: 'Virtual Email Regenerated',
          description: `A new virtual email was generated: ${newVirtualEmail.address}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }).catch(err => log.error({ err }, 'Failed to create virtual_email_regenerated activity log.'));

      log.info(`Regenerated virtual email for user ${userId}. New address: ${newVirtualEmail.address} `);
      res.status(200).json({ success: true, email: newVirtualEmail.address, canChange: newVirtualEmail.canChange, message: 'Virtual email regenerated successfully.' });
    } catch (error) {
      if (error.status) return next(error); // Forward known errors
      log.error({ err: error }, 'Error regenerating virtual email');
      next({ status: 500, message: 'Failed to regenerate virtual email', code: 'VIRTUAL_EMAIL_REGENERATE_ERROR' });
    }
  });

  // GET /api/user/linked-sites (with pagination)
  router.get('/linked-sites', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 5;
      const skip = (page - 1) * limit;

      const [sites, totalItems] = await prisma.$transaction([
        prisma.linkedSite.findMany({
          where: { userId },
          orderBy: { lastActivity: 'desc' },
          skip,
          take: limit,
          // Include the related ApiKey to get the logoUrl
          include: {
            apiKey: {
              select: { logoUrl: true }
            }
          }
        }),
        prisma.linkedSite.count({ where: { userId } }),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      res.status(200).json({
        sites,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          pageSize: limit,
        },
      });
    } catch (error) {
      log.error({ err: error }, 'Error fetching paginated linked sites');
      next({ status: 500, message: 'Failed to fetch linked sites', code: 'LINKED_SITES_FETCH_ERROR' });
    }
  });

  // DELETE /api/user/linked-sites/:id
  router.delete('/linked-sites/:id', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const siteId = Number(req.params.id);

      // Find the site before deleting to log its name
      const siteToUnlink = await prisma.linkedSite.findFirst({
        where: { id: siteId, userId },
      });

      await prisma.linkedSite.delete({
        where: { id: siteId, userId },
      });

      // --- إضافة سجل نشاط ---
      if (siteToUnlink) {
        prisma.activity.create({
          data: { userId, type: 'site_unlinked', title: 'Site Unlinked',
            description: `The site "${siteToUnlink.name}" was unlinked.`, ipAddress: req.ip, userAgent: req.headers['user-agent'],
           },
        }).catch(err => log.error({ err }, 'Failed to create site_unlinked activity log.'));
      }
      log.info(`User ${userId} unlinked site ${siteId}`);
      res.status(204).send();
    } catch (error) {
      if (error.code === 'P2025') {
        return next({ status: 404, message: 'Linked site not found or does not belong to user.', code: 'UNLINK_SITE_NOT_FOUND' });
      }
      next({ status: 500, message: 'Failed to unlink site', code: 'UNLINK_SITE_ERROR' });
    }
  });

  // GET /api/user/forwarded-logs (with pagination)
  router.get('/forwarded-logs', isAuthenticated, async (req, res, next) => {
    try {
      const userId = Number(req.session.user.id);
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 15;
      const skip = (page - 1) * limit;

      const [logs, totalItems] = await prisma.$transaction([
        prisma.forwardedEmailLog.findMany({
          where: { userId },
          orderBy: { forwardedAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            senderAddress: true,
            subject: true,
            forwardedAt: true,
          },
        }),
        prisma.forwardedEmailLog.count({ where: { userId } }),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      res.status(200).json({
        logs,
        pagination: { totalItems, totalPages, currentPage: page, pageSize: limit },
      });
    } catch (error) {
      log.error({ err: error }, 'Error fetching forwarded email logs');
      next({ status: 500, message: 'Failed to fetch forwarded email logs', code: 'FORWARDED_LOGS_FETCH_ERROR' });
    }
  });

  return router;
};

module.exports = createUserRouter;
