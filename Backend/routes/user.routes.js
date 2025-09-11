const express = require('express');
const { isAuthenticated } = require('./auth.middleware');
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
  router.get('/profile', isAuthenticated, async (req, res, next) => {
    try {
      // The user object is available from the session
      const { id } = req.session.user;

      // Fetch the full user profile from the database, but exclude sensitive data
      const userProfile = await prisma.user.findUnique({
        where: { id: Number(id) },
        select: {
          id: true,
          email: true,
          isVerified: true,
          createdAt: true,
        },
      });

      if (!userProfile) {
        // This case is unlikely if a session exists, but it's good practice to handle it.
        return next({ status: 404, message: 'User not found', code: 'USER_NOT_FOUND' });
      }

      res.status(200).json({ user: userProfile });
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
          logoUrl: true,
          createdAt: true,
        },
      });
      // Convert redirectUris string back to an array for the frontend
      const formattedKeys = keys.map(key => ({
        ...key,
        redirectUris: key.redirectUris ? key.redirectUris.split(',') : [],
      }));
      res.status(200).json(formattedKeys);
    } catch (error) {
      next({ status: 500, message: 'Failed to fetch API keys', code: 'API_KEY_FETCH_ERROR' });
    }
  });

  // POST /api/user/api-keys
  router.post('/api-keys', isAuthenticated, async (req, res, next) => {
    try {
      const { name, redirectUris, logoUrl } = req.body;
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

  return router;
};

module.exports = createUserRouter;
