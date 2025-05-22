const { validationResult } = require('express-validator');
const User = require('../models/user.model');
const Boost = require('../models/boost.model');
const UserBoost = require('../models/userBoost.model');
const Transaction = require('../models/transaction.model');
const Subscription = require('../models/subscription.model');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Boost Controller
 * Handles the token boost system functionality
 */

// Get all available boosts
exports.getAvailableBoosts = async (req, res, next) => {
  try {
    // Parse filter parameters
    const filters = {
      category: req.query.category,
      tierRequired: req.query.tier,
      minPrice: req.query.minPrice ? parseInt(req.query.minPrice, 10) : undefined,
      maxPrice: req.query.maxPrice ? parseInt(req.query.maxPrice, 10) : undefined,
      searchTerm: req.query.search
    };
    
    // Get user subscription tier to filter boosts by tier requirement
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(AppError.notFound('User not found'));
    }
    
    // Get all available boosts
    const boosts = await Boost.getAvailableBoosts(filters);
    
    // Filter boosts based on user's subscription tier
    const userTier = user.tier;
    const availableBoosts = boosts.filter(boost => {
      // Tier hierarchy: free < basic < premium < annual
      if (userTier === boost.tierRequired) return true;
      if (userTier === 'annual') return true; // Annual has access to all
      if (userTier === 'premium' && boost.tierRequired !== 'annual') return true;
      if (userTier === 'basic' && boost.tierRequired === 'free') return true;
      if (boost.tierRequired === 'free') return true;
      return false;
    });
    
    res.status(200).json({
      status: 'success',
      data: availableBoosts
    });
  } catch (error) {
    next(error);
  }
};

// Get a specific boost
exports.getBoost = async (req, res, next) => {
  try {
    const boostId = req.params.id;
    
    const boost = await Boost.findById(boostId);
    if (!boost) {
      return next(AppError.notFound('Boost not found'));
    }
    
    res.status(200).json({
      status: 'success',
      data: boost
    });
  } catch (error) {
    next(error);
  }
};

// Get user's active boosts
exports.getUserActiveBoosts = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Check if the requesting user has permission
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to view this user\'s boosts'));
    }
    
    // Get user's active boosts
    const activeBoosts = await UserBoost.getUserActiveBoosts(userId);
    
    res.status(200).json({
      status: 'success',
      data: activeBoosts
    });
  } catch (error) {
    next(error);
  }
};

// Get user's boost history
exports.getUserBoostHistory = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Check if the requesting user has permission
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to view this user\'s boost history'));
    }
    
    // Parse query parameters
    const params = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
      isActive: req.query.active === 'true' ? true : 
               req.query.active === 'false' ? false : null,
      category: req.query.category
    };
    
    // Get user's boost history
    const result = await UserBoost.getUserBoostHistory(userId, params);
    
    res.status(200).json({
      status: 'success',
      data: result.boosts,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

// Purchase a boost
exports.purchaseBoost = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(AppError.validation('Validation failed', errors.array()));
    }
    
    const { boostId } = req.body;
    const userId = req.user.id;
    
    // Get the boost
    const boost = await Boost.findById(boostId);
    if (!boost) {
      return next(AppError.notFound('Boost not found'));
    }
    
    // Check if boost is available
    if (!boost.isAvailable()) {
      return next(AppError.badRequest('This boost is not currently available'));
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return next(AppError.notFound('User not found'));
    }
    
    // Check if user has the required tier
    if (boost.tierRequired !== 'free' && user.tier === 'free') {
      return next(AppError.forbidden('This boost requires a premium subscription'));
    }
    
    // Check if user has reached the max per user limit
    if (boost.maxPerUser > 0) {
      const userBoostCount = await UserBoost.countDocuments({
        userId,
        boostId,
        purchasedAt: { $gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });
      
      if (userBoostCount >= boost.maxPerUser) {
        return next(AppError.badRequest(`You have reached the maximum purchase limit for this boost (${boost.maxPerUser})`));
      }
    }
    
    // Check if user has an active boost of the same type
    if (boost.cooldownPeriod > 0) {
      const hasActiveBoost = await UserBoost.findOne({
        userId,
        boostId,
        isActive: true
      });
      
      if (hasActiveBoost) {
        return next(AppError.badRequest('You already have an active boost of this type'));
      }
    }
    
    // Check if user has enough tokens
    if (user.tokenBalance < boost.price) {
      return next(AppError.badRequest('Insufficient token balance'));
    }
    
    // Start a transaction
    const session = await User.startSession();
    session.startTransaction();
    
    try {
      // Deduct tokens
      await user.updateTokenBalance(-boost.price);
      
      // Record transaction
      const transaction = await Transaction.recordTransaction({
        userId: user._id,
        type: 'spending',
        activity: 'boost_purchase',
        amount: -boost.price,
        balanceAfter: user.tokenBalance,
        description: `Purchased ${boost.name} boost for ${boost.price} tokens`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Create user boost record
      const userBoost = await UserBoost.createUserBoost(userId, boost, transaction._id);
      
      // Update boost stock
      await boost.updateStock();
      
      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      
      logger.info(`User ${user._id} purchased boost ${boost._id} (${boost.name}) for ${boost.price} tokens`);
      
      res.status(200).json({
        status: 'success',
        data: {
          userBoost,
          transaction: transaction._id,
          amount: -boost.price,
          newBalance: user.tokenBalance
        }
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// Activate a boost
exports.activateBoost = async (req, res, next) => {
  try {
    const { userBoostId } = req.params;
    const userId = req.user.id;
    
    // Get the user boost
    const userBoost = await UserBoost.findById(userBoostId);
    if (!userBoost) {
      return next(AppError.notFound('User boost not found'));
    }
    
    // Check if the boost belongs to the user
    if (userBoost.userId.toString() !== userId && req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to activate this boost'));
    }
    
    // Check if boost is already active
    if (!userBoost.isActive) {
      return next(AppError.badRequest('This boost is not active'));
    }
    
    // Get the boost type to apply the specific effect
    const boostType = userBoost.boostDetails.category;
    
    // Different effects based on boost type
    let effect = {}; 
    let targetId = req.body.targetId;
    
    switch (userBoost.boostId.toString()) {
      case 'squad_blast': // or appropriate ID mapping
        // Effect: Push clip to ALL friends' Squads Page for 24 hours
        effect = {
          type: 'squad_blast',
          clipId: targetId,
          duration: 24 * 60 * 60 * 1000, // 24 hours in ms
          timestamp: new Date()
        };
        break;
        
      case 'chain_reaction': // or appropriate ID mapping
        // Effect: Each like/comment/share spreads to 5 more users for 6h (stackable)
        effect = {
          type: 'chain_reaction',
          clipId: targetId,
          multiplier: 5,
          duration: 6 * 60 * 60 * 1000, // 6 hours in ms
          timestamp: new Date()
        };
        break;
        
      case 'im_the_king_now': // or appropriate ID mapping
        // Effect: Places stream in Top 10 for game category on main live page + golden crown
        effect = {
          type: 'im_the_king_now',
          streamId: targetId,
          gameCategory: req.body.gameCategory || 'general',
          duration: 2 * 60 * 60 * 1000, // 2 hours in ms
          badge: 'golden_crown',
          timestamp: new Date()
        };
        break;
        
      case 'stream_surge': // or appropriate ID mapping
        // Effect: Pushes stream to 200+ active viewers in its genre for 30 mins + trending badge
        effect = {
          type: 'stream_surge',
          streamId: targetId,
          genre: req.body.genre || 'general',
          viewerCount: 200,
          duration: 30 * 60 * 1000, // 30 minutes in ms
          badge: 'trending',
          timestamp: new Date()
        };
        break;
        
      default:
        effect = {
          type: 'generic',
          targetId,
          timestamp: new Date()
        };
    }
    
    // Record usage of the boost
    const usageResult = await userBoost.recordUsage();
    if (!usageResult) {
      return next(AppError.badRequest('Failed to activate boost. It may have expired or reached its usage limit.'));
    }
    
    // Store the effect details (in a real implementation, this would trigger actual effects in the system)
    userBoost.lastEffect = effect;
    await userBoost.save();
    
    logger.info(`User ${userId} activated boost ${userBoostId} with effect ${effect.type}`);
    
    res.status(200).json({
      status: 'success',
      data: {
        userBoost,
        effect,
        message: `${userBoost.boostDetails.name} boost activated successfully`,
        usageCount: userBoost.usageCount,
        usageLimit: userBoost.usageLimit,
        expiresAt: userBoost.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// Deactivate a boost (admin or user)
exports.deactivateBoost = async (req, res, next) => {
  try {
    const { userBoostId } = req.params;
    const userId = req.user.id;
    const reason = req.body.reason;
    
    // Get the user boost
    const userBoost = await UserBoost.findById(userBoostId);
    if (!userBoost) {
      return next(AppError.notFound('User boost not found'));
    }
    
    // Check if the boost belongs to the user or if admin
    const isAdmin = req.user.role === 'admin';
    if (userBoost.userId.toString() !== userId && !isAdmin) {
      return next(AppError.forbidden('You do not have permission to deactivate this boost'));
    }
    
    // Check if boost is already inactive
    if (!userBoost.isActive) {
      return next(AppError.badRequest('This boost is already inactive'));
    }
    
    // Deactivate the boost
    await userBoost.deactivate(isAdmin ? req.user.id : null, reason);
    
    logger.info(`Boost ${userBoostId} deactivated by ${userId}${reason ? ` with reason: ${reason}` : ''}`);
    
    res.status(200).json({
      status: 'success',
      message: 'Boost deactivated successfully',
      data: {
        userBoostId,
        isActive: false,
        deactivatedAt: userBoost.deactivatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create a new boost (admin only)
exports.createBoost = async (req, res, next) => {
  try {
    // Only admins can create boosts
    if (req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to create boosts'));
    }
    
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(AppError.validation('Validation failed', errors.array()));
    }
    
    // Create boost from request data
    const boostData = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      image: req.body.image,
      isActive: req.body.isActive !== false, // Default to active
      duration: req.body.duration,
      tierRequired: req.body.tierRequired || 'free',
      stockLimit: req.body.stockLimit || -1,
      currentStock: req.body.stockLimit || -1,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      maxPerUser: req.body.maxPerUser || -1,
      cooldownPeriod: req.body.cooldownPeriod || 0,
      effectMultiplier: req.body.effectMultiplier || 1,
      effectDetails: req.body.effectDetails || {},
      createdBy: req.user.id
    };
    
    const boost = await Boost.create(boostData);
    
    logger.info(`Admin ${req.user.id} created new boost: ${boost.name}`);
    
    res.status(201).json({
      status: 'success',
      data: boost
    });
  } catch (error) {
    next(error);
  }
};

// Initialize default boosts (admin only)
exports.initializeDefaultBoosts = async (req, res, next) => {
  try {
    // Only admins can initialize default boosts
    if (req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to initialize boosts'));
    }
    
    // Check if boosts already exist
    const existingBoosts = await Boost.countDocuments();
    if (existingBoosts > 0) {
      return next(AppError.badRequest('Boosts are already initialized'));
    }
    
    // Create default boosts based on Clipt's specifications
    const defaultBoosts = [
      {
        name: 'Squad Blast',
        description: 'Push your clip to ALL of your friends\' Squads Page for 24 hours.',
        price: 40,
        category: 'visibility',
        image: 'https://placehold.co/200x200/FF5722/white?text=SQUAD',
        isActive: true,
        duration: 1, // 1 day
        tierRequired: 'free',
        effectMultiplier: 1,
        effectDetails: {
          targetType: 'clip',
          distribution: 'friends',
          duration: 24 // hours
        }
      },
      {
        name: 'Chain Reaction',
        description: 'Each like/comment/share spreads clip to 5 more users for 6h (stackable).',
        price: 60,
        category: 'viral',
        image: 'https://placehold.co/200x200/4CAF50/white?text=CHAIN',
        isActive: true,
        duration: 0.25, // 6 hours
        tierRequired: 'free',
        effectMultiplier: 5,
        effectDetails: {
          targetType: 'clip',
          multiplier: 5,
          triggerEvents: ['like', 'comment', 'share'],
          duration: 6 // hours
        }
      },
      {
        name: 'I\'m the King Now',
        description: 'Places stream in Top 10 for the selected game category on the main live page for 2 hours + golden crown badge.',
        price: 80,
        category: 'ranking',
        image: 'https://placehold.co/200x200/FFC107/white?text=KING',
        isActive: true,
        duration: 0.083, // ~2 hours
        tierRequired: 'basic', // Pro tier or higher
        effectMultiplier: 1,
        effectDetails: {
          targetType: 'stream',
          placement: 'top10',
          badge: 'golden_crown',
          duration: 2 // hours
        }
      },
      {
        name: 'Stream Surge',
        description: 'Pushes stream to 200+ active viewers in its genre for 30 mins + trending badge.',
        price: 50,
        category: 'visibility',
        image: 'https://placehold.co/200x200/2196F3/white?text=SURGE',
        isActive: true,
        duration: 0.02, // ~30 minutes
        tierRequired: 'free',
        effectMultiplier: 1,
        effectDetails: {
          targetType: 'stream',
          viewerCount: 200,
          badge: 'trending',
          duration: 0.5 // hours
        }
      }
    ];
    
    // Create boosts
    const createdBoosts = await Boost.insertMany(defaultBoosts.map(boost => ({
      ...boost,
      createdBy: req.user.id
    })));
    
    logger.info(`Admin ${req.user.id} initialized ${createdBoosts.length} default boosts`);
    
    res.status(201).json({
      status: 'success',
      message: `${createdBoosts.length} default boosts created`,
      data: createdBoosts
    });
  } catch (error) {
    next(error);
  }
};

// Update a boost (admin only)
exports.updateBoost = async (req, res, next) => {
  try {
    // Only admins can update boosts
    if (req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to update boosts'));
    }
    
    const boostId = req.params.id;
    
    // Get the boost
    const boost = await Boost.findById(boostId);
    if (!boost) {
      return next(AppError.notFound('Boost not found'));
    }
    
    // Update fields
    if (req.body.name) boost.name = req.body.name;
    if (req.body.description) boost.description = req.body.description;
    if (req.body.price !== undefined) boost.price = req.body.price;
    if (req.body.category) boost.category = req.body.category;
    if (req.body.image) boost.image = req.body.image;
    if (req.body.isActive !== undefined) boost.isActive = req.body.isActive;
    if (req.body.duration !== undefined) boost.duration = req.body.duration;
    if (req.body.tierRequired) boost.tierRequired = req.body.tierRequired;
    if (req.body.stockLimit !== undefined) boost.stockLimit = req.body.stockLimit;
    if (req.body.startDate !== undefined) boost.startDate = req.body.startDate;
    if (req.body.endDate !== undefined) boost.endDate = req.body.endDate;
    if (req.body.maxPerUser !== undefined) boost.maxPerUser = req.body.maxPerUser;
    if (req.body.cooldownPeriod !== undefined) boost.cooldownPeriod = req.body.cooldownPeriod;
    if (req.body.effectMultiplier !== undefined) boost.effectMultiplier = req.body.effectMultiplier;
    if (req.body.effectDetails) boost.effectDetails = req.body.effectDetails;
    
    await boost.save();
    
    logger.info(`Admin ${req.user.id} updated boost ${boostId}`);
    
    res.status(200).json({
      status: 'success',
      data: boost
    });
  } catch (error) {
    next(error);
  }
};
