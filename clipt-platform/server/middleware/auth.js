const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const User = require('../models/user.model');

/**
 * Authentication middleware to protect routes
 * Verifies JWT token and attaches the user to the request object
 */
exports.protect = async (req, res, next) => {
  try {
    // Get token from authorization header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return next(AppError.unauthorized('Authentication required to access this resource'));
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clipt_jwt_secret_key_change_this');

    // Check if user still exists
    const currentUser = await User.findById(decoded.id).select('-password');
    if (!currentUser) {
      return next(AppError.unauthorized('The user belonging to this token no longer exists'));
    }

    // Check if user changed password after the token was issued
    if (currentUser.passwordChangedAfter && 
        currentUser.passwordChangedAfter(decoded.iat)) {
      return next(AppError.unauthorized('User recently changed password. Please log in again'));
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  } catch (err) {
    next(AppError.unauthorized('Invalid authentication token'));
  }
};

/**
 * Authorization middleware to restrict to certain roles
 * @param {...String} roles - Allowed roles
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
};

/**
 * Refresh token middleware
 * Handles token refresh requests
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(AppError.badRequest('Refresh token is required'));
    }

    // Verify the refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'clipt_refresh_secret_key_change_this'
    );

    // Find the user
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(AppError.unauthorized('Invalid refresh token'));
    }

    // Generate a new access token
    const token = user.generateAuthToken();

    res.status(200).json({
      status: 'success',
      token
    });
  } catch (err) {
    next(AppError.unauthorized('Invalid or expired refresh token'));
  }
};
