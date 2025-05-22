const logger = require('../utils/logger');

/**
 * Central error handling middleware
 * Standardizes API error responses
 */
exports.errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error(`${err.name}: ${err.message}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user ? req.user.id : 'unauthenticated',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Authentication/authorization errors
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Authentication required or token is invalid',
    });
  }

  // Validation errors (express-validator)
  if (err.name === 'ValidationError' || (err.errors && Array.isArray(err.errors))) {
    return res.status(422).json({
      status: 'error', 
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: err.errors || [{ msg: err.message }],
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      status: 'error',
      code: 'DUPLICATE_RESOURCE',
      message: `Resource already exists: ${field}`,
    });
  }

  // Not found errors
  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      status: 'error',
      code: 'RESOURCE_NOT_FOUND',
      message: err.message || 'Resource not found',
    });
  }

  // Rate limiting errors
  if (err.name === 'TooManyRequestsError') {
    return res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: err.message || 'Rate limit exceeded',
    });
  }

  // Payment errors (Stripe)
  if (err.name === 'StripeError') {
    const statusCode = err.statusCode || 400;
    return res.status(statusCode).json({
      status: 'error',
      code: err.code || 'PAYMENT_ERROR',
      message: err.message || 'Payment processing error',
    });
  }

  // Custom app errors
  if (err.statusCode && err.errorCode) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.errorCode,
      message: err.message,
      details: err.details || undefined,
    });
  }

  // Default to 500 server error for unhandled exceptions
  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message || 'Internal server error',
  });
};

/**
 * Application error class for creating consistent errors
 */
class AppError extends Error {
  constructor(message, errorCode, statusCode = 400, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 'RESOURCE_NOT_FOUND', 404);
  }

  static badRequest(message, details = null) {
    return new AppError(message, 'BAD_REQUEST', 400, details);
  }

  static unauthorized(message = 'Unauthorized access') {
    return new AppError(message, 'UNAUTHORIZED', 401);
  }

  static forbidden(message = 'Permission denied') {
    return new AppError(message, 'FORBIDDEN', 403);
  }

  static validation(message = 'Validation failed', details = null) {
    return new AppError(message, 'VALIDATION_ERROR', 422, details);
  }

  static conflict(message, details = null) {
    return new AppError(message, 'CONFLICT', 409, details);
  }

  static paymentRequired(message = 'Payment required', details = null) {
    return new AppError(message, 'PAYMENT_REQUIRED', 402, details);
  }

  static tooManyRequests(message = 'Rate limit exceeded') {
    return new AppError(message, 'RATE_LIMIT_EXCEEDED', 429);
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 'INTERNAL_SERVER_ERROR', 500);
  }
}

exports.AppError = AppError;
