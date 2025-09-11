const express = require('express');
const { isAuthenticated } = require('./auth.middleware');
const { getDashboardStats } = require('../services/dashboard.service');

const createDashboardRouter = (prisma, log) => {
  const router = express.Router();

  router.get('/stats', isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.session.user.id;
      const stats = await getDashboardStats(userId, prisma, log);
      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  });

  return router;
};

module.exports = createDashboardRouter;

