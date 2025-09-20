const express = require('express');
const { isAuthenticated } = require('./auth.middleware');
const { initializeSSE } = require('../services/sse.service');

const createNotificationRouter = (log) => {
  const router = express.Router();

  // تطبيق middleware المصادقة على جميع المسارات في هذا الموجه
  router.use(isAuthenticated);

  // تهيئة نقطة وصول SSE
  initializeSSE(router, log);

  return router;
};

module.exports = createNotificationRouter;