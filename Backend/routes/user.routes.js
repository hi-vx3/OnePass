const express = require('express');
const { isAuthenticated, requireScope } = require('./auth.middleware');
const { v4: uuidv4 } = require('uuid');

// Argon2 for hashing client secrets
const argon2 = require('argon2');

const createUserRouter = (prisma, log) => {
  const router = express.Router();

  // Helper function to generate a secure secret
  const generateClientSecret = () => {
    return `onepass_sk_${uuidv4().replace(/-/g, '')}`;
  };

  // This is a protected route.
  // The `isAuthenticated` middleware runs before the route handler.
  // It can be accessed by a logged-in user via session, or by an API key with the 'read:user' scope.
  router.get('/profile', isAuthenticated, requireScope('read:user'), async (req, res, next) => {
    try {
      // The user object is available from the session
      // The `isAuthenticated` or `requireScope` middleware will attach the user to the request.
      const userId = req.session.user?.id || req.user?.id;
      const isApiRequest = !!req.apiKey;

      if (!userId) {
        return next({ status: 401, message: 'Authentication required.', code: 'AUTH_REQUIRED' });
      }

      // Fetch the full user profile from the database, but exclude sensitive data
      const userProfile = await prisma.user.findUnique({
        where: { id: Number(userId) },
        select: {
          id: true,
          // Conditionally select the email based on the request type
          email: !isApiRequest, // Only select real email if it's NOT an API request
          isVerified: true,
          createdAt: true,
          // For API requests, fetch the virtual email address
          virtualEmail: isApiRequest ? { select: { address: true } } : false,
        },
      });

      if (!userProfile) {
        // This case is unlikely if a session exists, but it's good practice to handle it.
        return next({ status: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
      }

      // Construct a consistent response payload
      const responsePayload = {
        id: userProfile.id,
        // If it's an API request, the `email` field will contain the virtual email address.
        // Otherwise, it will contain the real user email.
        email: isApiRequest ? userProfile.virtualEmail?.address : userProfile.email,
        isVerified: userProfile.isVerified,
        createdAt: userProfile.createdAt,
      };

      res.status(200).json({ user: responsePayload });
    } catch (error) {
      log.error({ err: error }, 'Error fetching user profile');
      next({ status: 500, message: 'Server error while fetching profile', code: 'SERVER_ERROR' });
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
      const { name, redirectUris, logoUrl, scopes } = req.body;
      if (!name || !Array.isArray(redirectUris) || redirectUris.length === 0) {
        return next({ status: 400, message: 'Name and at least one Redirect URI are required.', code: 'INVALID_INPUT' });
      }

      const userId = Number(req.session.user.id);
      const clientId = `onepass_client_${uuidv4().replace(/-/g, '')}`;
      const clientSecret = generateClientSecret();
      const hashedSecret = await argon2.hash(clientSecret);

      const createdKey = await prisma.apiKey.create({
        data: {
          name,
          clientId,
          clientSecret, // Note: Storing the raw secret is for one-time display. It will not be queryable.
          hashedSecret,
          redirectUris: redirectUris.join(','), // Store as a comma-separated string
          scopes: (scopes || []).join(','), // Store scopes as a comma-separated string
          logoUrl,
          userId,
        },
      });
      res.status(201).json(createdKey);
    } catch (error) {
      log.error({ err: error }, 'Error creating API key');
      next({ status: 500, message: 'Failed to create API key', code: 'API_KEY_CREATE_ERROR' });
    }
  });

  // PATCH /api/user/api-keys/:id
  router.patch('/api-keys/:id', isAuthenticated, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, redirectUris, logoUrl, scopes } = req.body;
      const userId = Number(req.session.user.id);

      if (!name || !Array.isArray(redirectUris) || redirectUris.length === 0) {
        return next({ status: 400, message: 'Name and at least one Redirect URI are required.', code: 'INVALID_INPUT' });
      }

      const updatedKey = await prisma.apiKey.update({
        where: { id, userId }, // Ensures user can only update their own keys
        data: {
          name,
          redirectUris: redirectUris.join(','),
          scopes: (scopes || []).join(','),
          logoUrl,
        },
      });

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
      await prisma.apiKey.delete({
        where: { id, userId },
      });
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
      await prisma.linkedSite.delete({
        where: { id: siteId, userId },
      });
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
