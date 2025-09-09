module.exports = (err, req, res, next) => {
  const { logger } = require('./logger');
  const log = logger();
  log.error(err.message);
  res.status(err.status || 500).json({
    success: false,
    status: err.status || 500,
    error: err.message,
  });
};