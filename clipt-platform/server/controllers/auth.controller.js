const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const User = require('../models/user.model');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles user registration, login, and token management
 */

// Register new user
exports.register = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(AppError.validation('Validation failed', errors.array()));
    }

    const { username, email, password } = req.body;

    // Check if email already exists
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return next(AppError.conflict('Email already in use'));
    }

    // Check if username already exists
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return next(AppError.conflict('Username already taken'));
    }

    // Create new user
    const user = new User({
      username,
      email,
      password, // Will be hashed in the pre-save hook
      tokenBalance: 100, // Signup bonus
    });

    await user.save();

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
    });
  } catch (error) {
    next(error);
  }
};

// User login
exports.login = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(AppError.validation('Validation failed', errors.array()));
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return next(AppError.unauthorized('Invalid email or password'));
    }

    // Check password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return next(AppError.unauthorized('Invalid email or password'));
    }

    // Generate tokens
    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Save refresh token to user document
    await user.save();

    // Update last active timestamp
    user.lastActive = new Date();
    await user.save();

    logger.info(`User logged in: ${user.email} (${user._id})`);

    // Send response without password
    const userWithoutPassword = user.toPublicJSON();

    res.status(200).json({
      status: 'success',
      user: userWithoutPassword,
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// Refresh access token
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return next(AppError.badRequest('Refresh token is required'));
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'clipt_refresh_secret_key_change_this'
      );
    } catch (err) {
      return next(AppError.unauthorized('Invalid or expired refresh token'));
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(AppError.unauthorized('User not found'));
    }

    // Verify that this refresh token matches the one stored with the user
    if (user.refreshToken !== refreshToken) {
      return next(AppError.unauthorized('Refresh token has been revoked'));
    }

    // Generate new access token
    const newToken = user.generateAuthToken();

    res.status(200).json({
      status: 'success',
      token: newToken,
    });
  } catch (error) {
    next(error);
  }
};

// Logout user
exports.logout = async (req, res, next) => {
  try {
    // Clear refresh token from user document
    const user = await User.findById(req.user.id);
    if (user) {
      user.refreshToken = undefined;
      await user.save();
    }

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
exports.getCurrentUser = async (req, res, next) => {
  try {
    // User is attached to req by auth middleware
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return next(AppError.notFound('User not found'));
    }

    res.status(200).json({
      status: 'success',
      data: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// Change password
exports.changePassword = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(AppError.validation('Validation failed', errors.array()));
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return next(AppError.notFound('User not found'));
    }

    // Verify current password
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      return next(AppError.unauthorized('Current password is incorrect'));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info(`Password changed for user: ${user.email} (${user._id})`);

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Request password reset
exports.requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists for security reasons
      return res.status(200).json({
        status: 'success',
        message: 'If a user with that email exists, a password reset link has been sent',
      });
    }

    // Generate password reset token (to be implemented)
    // const resetToken = user.createPasswordResetToken();
    // await user.save();

    // Send password reset email (to be implemented)
    // await sendPasswordResetEmail(user.email, resetToken);

    res.status(200).json({
      status: 'success',
      message: 'If a user with that email exists, a password reset link has been sent',
    });
  } catch (error) {
    next(error);
  }
};

// Reset password with token
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    // Find user with valid reset token (to be implemented)
    // const user = await User.findOne({
    //   passwordResetToken: token,
    //   passwordResetExpires: { $gt: Date.now() },
    // });

    // if (!user) {
    //   return next(AppError.unauthorized('Token is invalid or has expired'));
    // }

    // // Update password
    // user.password = newPassword;
    // user.passwordResetToken = undefined;
    // user.passwordResetExpires = undefined;
    // await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    next(error);
  }
};
