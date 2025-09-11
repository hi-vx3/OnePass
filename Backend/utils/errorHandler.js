module.exports = (err, req, res, next, log) => {
  // Log the full error object for better debugging
  const status = err.status || 500;
  const message = err.message || 'An unexpected error occurred.';

  // Ensure we log the most useful information, regardless of error structure
  log.error(
    { err },
    `Error occurred: ${message}`
  );

  // Send a consistent, safe response to the client
  res.status(status).send({
    success: false,
    status: status,
    error: message,
  });
};