const express = require('express');
const { isAuthenticated } = require('./auth.middleware');
const UAParser = require('ua-parser-js');

/**
 * @param {import('ioredis').Redis} redisClient
 * @param {import('@pino/pino').Logger} log
 * @returns {import('express').Router}
 */
function createSessionRouter(redisClient, log) {
  const router = express.Router();

  /**
   * GET /api/sessions/active
   * يجلب جميع الجلسات النشطة للمستخدم الحالي.
   */
  router.get('/active', isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const stream = redisClient.scanStream({
        match: `onepass:session:user:${userId}:*`,
        count: 100,
      });

      const sessionKeys = [];
      for await (const keys of stream) {
        sessionKeys.push(...keys);
      }

      if (sessionKeys.length === 0) {
        return res.json([]);
      }

      const sessionsData = await redisClient.mget(sessionKeys);
      const currentSessionId = req.session.id;

      const activeDevices = sessionsData
        .map((sessionStr, index) => {
          if (!sessionStr) return null;
          try {
            const session = JSON.parse(sessionStr);
            const parser = new UAParser(session.userAgent);
            const device = parser.getResult();
            const sessionId = sessionKeys[index].split(':').pop();

            return {
              id: sessionId,
              isCurrent: sessionId === currentSessionId,
              browser: `${device.browser.name || 'N/A'} ${device.browser.version || ''}`.trim(),
              os: `${device.os.name || 'N/A'} ${device.os.version || ''}`.trim(),
              ip: session.ip,
              lastAccessed: session.cookie.expires,
            };
          } catch (error) {
            log.error({ err: error, sessionStr }, 'Failed to parse session string');
            return null;
          }
        })
        .filter(Boolean);

      res.json(activeDevices);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createSessionRouter;