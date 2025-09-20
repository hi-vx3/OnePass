const express = require('express');
const { isAuthenticated } = require('./auth.middleware');
const axios = require('axios');

const createPaymentRouter = (prisma, log) => {
  const router = express.Router();

  if (!process.env.TAP_SECRET_KEY) {
    log.warn('TAP_SECRET_KEY is not set. Payment routes will be disabled.');
    return router;
  }

  const tapApi = axios.create({
    baseURL: 'https://api.tap.company/v2',
    headers: {
      Authorization: `Bearer ${process.env.TAP_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  /**
   * POST /api/payment/create-tap-charge
   * Creates a Tap Payments charge and returns a redirect URL.
   */
  router.post('/create-tap-charge', isAuthenticated, async (req, res, next) => {
    const { amount, currency, description } = req.body;
    const userId = req.session.user.id;

    if (!amount || !currency) {
      return next({ status: 400, message: 'Amount and currency are required.', code: 'PAYMENT_PARAMS_MISSING' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });

      const chargeResponse = await tapApi.post('/charges', {
        amount: amount,
        currency: currency,
        customer: {
          first_name: user.name || 'User',
          email: user.email,
        },
        source: { id: 'src_all' }, // To show all available payment methods
        description: description || 'OnePass PRO Subscription',
        metadata: {
          userId: user.id.toString(),
        },
        redirect: {
          url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?payment=success`,
        },
      });

      res.json({ url: chargeResponse.data.transaction.url });
    } catch (error) {
      log.error({ err: error.response?.data || error }, 'Tap Payments charge creation failed.');
      next({ status: 500, message: 'Failed to create payment session.', code: 'TAP_CHARGE_ERROR' });
    }
  });

  return router;
};

module.exports = createPaymentRouter;