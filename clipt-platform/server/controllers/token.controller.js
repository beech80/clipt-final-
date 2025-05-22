const { validationResult } = require('express-validator');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const Subscription = require('../models/subscription.model');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Token Controller
 * Handles token earning, spending, and analytics
 */

// Get user token balance and limits
exports.getTokenBalance = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Check if the requesting user has permission
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to view this user\'s token balance'));
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return next(AppError.notFound('User not found'));
    }
    
    // Get subscription details to provide context about token limits
    const subscription = await Subscription.findOne({ userId });
    
    res.status(200).json({
      status: 'success',
      data: {
        userId: user._id,
        tokenBalance: user.tokenBalance,
        dailyTokensEarned: user.dailyTokensEarned,
        dailyTokensLimit: user.dailyTokensLimit,
        totalTokensEarned: user.totalTokensEarned,
        totalTokensSpent: user.totalTokensSpent,
        activeDaysStreak: user.activeDaysStreak,
        tier: user.tier,
        tokenMultiplier: user.tokenMultiplier,
        hasDailyLimitReached: user.dailyTokensEarned >= user.dailyTokensLimit,
        // Include tier details if available
        tierDetails: subscription ? {
          name: subscription.tierId === 'free' ? 'Free' : 
                subscription.tierId === 'basic' ? 'Pro' : 'Maxed',
          price: subscription.tierId === 'free' ? 0 : 
                 subscription.tierId === 'basic' ? 4.99 : 14.99,
          isActive: subscription.status === 'active',
          renewalDate: subscription.renewalDate
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
};

// Earn tokens
exports.earnTokens = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(AppError.validation('Validation failed', errors.array()));
    }
    
    const { activity, amount } = req.body;
    const userId = req.user.id;
    
    // Validate activity type
    const validActivities = [
      'stream_watch',
      'chat_message',
      'daily_login',
      'referral',
      'promotion',
      'gift',
      'streak_bonus',
      'task_completion',
      'engagement',
      'subscription_bonus'
    ];
    
    if (!validActivities.includes(activity)) {
      return next(AppError.badRequest('Invalid activity type'));
    }
    
    // Validate amount
    if (!amount || amount <= 0) {
      return next(AppError.badRequest('Amount must be positive'));
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return next(AppError.notFound('User not found'));
    }
    
    // Check daily limit
    if (user.dailyTokensEarned >= user.dailyTokensLimit) {
      return next(AppError.badRequest('Daily token earning limit reached'));
    }
    
    // Apply tier multiplier if applicable
    let adjustedAmount = amount;
    if (user.tokenMultiplier > 1) {
      adjustedAmount = Math.floor(amount * user.tokenMultiplier);
    }
    
    // Cap earning to daily limit
    const remainingDaily = user.dailyTokensLimit - user.dailyTokensEarned;
    if (adjustedAmount > remainingDaily) {
      adjustedAmount = remainingDaily;
    }
    
    // Update token balance
    const balanceUpdate = await user.updateTokenBalance(adjustedAmount);
    
    // Record transaction
    const transaction = await Transaction.recordTransaction({
      userId: user._id,
      type: 'earning',
      activity,
      amount: adjustedAmount,
      balanceAfter: user.tokenBalance,
      description: `Earned ${adjustedAmount} tokens from ${activity.replace('_', ' ')}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    logger.info(`User ${user._id} earned ${adjustedAmount} tokens from ${activity}`);
    
    res.status(200).json({
      status: 'success',
      data: {
        transaction: transaction._id,
        amount: adjustedAmount,
        originalAmount: amount,
        multiplier: user.tokenMultiplier,
        newBalance: user.tokenBalance,
        dailyEarned: user.dailyTokensEarned,
        dailyLimit: user.dailyTokensLimit,
        isAtDailyLimit: balanceUpdate.isAtDailyLimit
      }
    });
  } catch (error) {
    next(error);
  }
};

// Spend tokens
exports.spendTokens = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(AppError.validation('Validation failed', errors.array()));
    }
    
    const { item, amount } = req.body;
    const userId = req.user.id;
    
    // Validate spend item type
    const validItems = [
      'boost_purchase',
      'chat_badge',
      'emote_pack',
      'custom_color',
      'stream_highlight',
      'priority_question',
      'feature_unlock',
      'gift_to_user',
      'squad_blast',        // Specific boosts from user's memory
      'chain_reaction',
      'im_the_king_now',
      'stream_surge'
    ];
    
    if (!validItems.includes(item)) {
      return next(AppError.badRequest('Invalid item type'));
    }
    
    // Validate amount is positive
    if (!amount || amount <= 0) {
      return next(AppError.badRequest('Amount must be positive'));
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return next(AppError.notFound('User not found'));
    }
    
    // Check if user has enough tokens
    if (user.tokenBalance < amount) {
      return next(AppError.badRequest('Insufficient token balance'));
    }
    
    // Update token balance (negative for spending)
    await user.updateTokenBalance(-amount);
    
    // Record transaction
    const transaction = await Transaction.recordTransaction({
      userId: user._id,
      type: 'spending',
      activity: item,
      amount: -amount, // Negative for spending
      balanceAfter: user.tokenBalance,
      description: `Spent ${amount} tokens on ${item.replace('_', ' ')}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    logger.info(`User ${user._id} spent ${amount} tokens on ${item}`);
    
    res.status(200).json({
      status: 'success',
      data: {
        transaction: transaction._id,
        amount: -amount,
        newBalance: user.tokenBalance,
        item
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get token transaction history
exports.getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Check if the requesting user has permission
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to view this user\'s transaction history'));
    }
    
    // Parse query parameters
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const type = req.query.type; // 'earning' or 'spending'
    const activity = req.query.activity;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    
    // Get transaction history
    const result = await Transaction.getUserTransactions(userId, {
      page,
      limit,
      type,
      activity,
      startDate,
      endDate,
      sort: 'createdAt',
      order: 'desc'
    });
    
    res.status(200).json({
      status: 'success',
      data: result.transactions,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

// Get token analytics
exports.getTokenAnalytics = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Check if the requesting user has permission
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to view this user\'s analytics'));
    }
    
    // Get time range from query parameter
    const timeRange = req.query.range || '7d'; // Default to 7 days
    
    // Get analytics
    const analytics = await Transaction.getAnalytics(userId, timeRange);
    
    res.status(200).json({
      status: 'success',
      data: analytics
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Adjust user tokens
exports.adjustUserTokens = async (req, res, next) => {
  try {
    // Only admins can adjust tokens
    if (req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to adjust user tokens'));
    }
    
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(AppError.validation('Validation failed', errors.array()));
    }
    
    const { userId, amount, reason } = req.body;
    
    // Validate amount is not zero
    if (amount === 0) {
      return next(AppError.badRequest('Adjustment amount cannot be zero'));
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return next(AppError.notFound('User not found'));
    }
    
    // Check for negative adjustment
    if (amount < 0 && Math.abs(amount) > user.tokenBalance) {
      return next(AppError.badRequest('Adjustment would result in negative balance'));
    }
    
    // Update token balance
    await user.updateTokenBalance(amount);
    
    // Record transaction
    const transaction = await Transaction.recordTransaction({
      userId: user._id,
      type: amount > 0 ? 'adjustment' : 'spending',
      activity: 'admin_adjustment',
      amount,
      balanceAfter: user.tokenBalance,
      description: reason || `Admin token adjustment: ${amount > 0 ? '+' : ''}${amount} tokens`,
      adminId: req.user.id
    });
    
    logger.info(`Admin ${req.user.id} adjusted user ${userId} tokens by ${amount}. Reason: ${reason || 'None provided'}`);
    
    res.status(200).json({
      status: 'success',
      data: {
        transaction: transaction._id,
        amount,
        newBalance: user.tokenBalance,
        userId: user._id
      }
    });
  } catch (error) {
    next(error);
  }
};
