const express = require('express');
const { getSystemStatus } = require('../services/status.service');

const createStatusRouter = (prisma, redisClient, log) => {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const status = await getSystemStatus(prisma, redisClient, log);
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = createStatusRouter;