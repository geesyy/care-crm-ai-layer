const { AppError } = require('../utils/errors');

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    console.error('[error]', err.message, err.stack);
  }

  res.status(statusCode).json({
    error: {
      code,
      message: err.message || 'An unexpected error occurred',
      details: err.details,
    },
  });
}

function notFoundHandler(_req, _res, next) {
  next(new AppError('Route not found', 404, 'ROUTE_NOT_FOUND'));
}

module.exports = { errorHandler, notFoundHandler };
