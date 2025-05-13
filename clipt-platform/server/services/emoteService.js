/**
 * Emote Service
 * Handles emote management, access control, and caching for the chat system
 */

const mongoose = require('mongoose');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const config = require('../config');

// Redis client for caching
const redisClient = new Redis(config.redis.url);

// Cache TTLs
const CACHE_TTL = {
  GLOBAL_EMOTES: 3600, // 1 hour
  USER_EMOTES: 300,    // 5 minutes
  TIER_EMOTES: 3600,   // 1 hour
  CHANNEL_EMOTES: 300  // 5 minutes
};

// Emote Schema (would be in models directory in production)
const emoteSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['global', 'subscriber', 'channel', 'custom'],
    default: 'global'
  },
  tier: {
    type: String,
    enum: ['free', 'basic', 'premium', 'annual'],
    default: 'free'
  },
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: function() {
      return this.type === 'channel';
    }
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isAnimated: {
    type: Boolean,
    default: false
  },
  width: {
    type: Number,
    default: 28
  },
  height: {
    type: Number,
    default: 28
  },
  approved: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create Emote model
const Emote = mongoose.models.Emote || mongoose.model('Emote', emoteSchema);

/**
 * Get all global emotes
 * @returns {Promise<Array>} Array of global emotes
 */
async function getGlobalEmotes() {
  try {
    // Try to get from cache first
    
    // Cache timeouts
    this.CACHE_TIMEOUT = {
      GLOBAL_EMOTES: 60 * 60, // 1 hour
      CHANNEL_EMOTES: 60 * 10, // 10 minutes
      USER_EMOTES: 60 * 5 // 5 minutes
 * @param {string} userId User ID
 * @returns {Promise<Array>} Array of user-specific emotes
 */
async function getUserEmotes(userId) {
  if (!userId) return [];
  
  try {
    // Try to get from cache first
    const cachedEmotes = await redisClient.get(`emotes:user:${userId}`);
    if (cachedEmotes) {
      return JSON.parse(cachedEmotes);
    }
    
    // Get user data to determine tier
    const user = await mongoose.model('User').findById(userId).lean();
    if (!user) return [];
    
    // Combine user's tier emotes and any custom emotes they have
    const tierEmotes = await getTierEmotes(user.tier || 'free');
    
    // Get any channel-specific emotes for channels the user is subscribed to
    const userSubscriptions = await mongoose.model('Subscription').find({
      userId,
      status: 'active',
      type: 'channel'
    }).lean();
    
    const channelIds = userSubscriptions.map(sub => sub.channelId);
    
    // Get channel emotes
    const channelEmotes = channelIds.length > 0
      ? await Emote.find({
          type: 'channel',
          channelId: { $in: channelIds },
          approved: true
        }).lean()
      : [];
    
    // Combine all emotes
    const userEmotes = [...tierEmotes, ...channelEmotes];
    
    // Cache the results
    await redisClient.set(
      `emotes:user:${userId}`,
      JSON.stringify(userEmotes),
      'EX',
      CACHE_TTL.USER_EMOTES
    );
    
    return userEmotes;
  } catch (error) {
    logger.error(`Error fetching emotes for user ${userId}:`, error);
    return [];
  }
}

/**
 * Get emotes available for a subscription tier
 * @param {string} tier Subscription tier
 * @returns {Promise<Array>} Array of tier-specific emotes
 */
async function getTierEmotes(tier = 'free') {
  try {
    // Try to get from cache first
    const cachedEmotes = await redisClient.get(`emotes:tier:${tier}`);
    if (cachedEmotes) {
      return JSON.parse(cachedEmotes);
    }
    
    // Define tier levels for hierarchical access
    const tierLevels = {
      'free': 0,
      'basic': 1,
      'premium': 2,
      'annual': 3
    };
    
    // Get current tier level
    const currentTierLevel = tierLevels[tier] || 0;
    
    // Get all tiers the user has access to
    const accessibleTiers = Object.keys(tierLevels).filter(
      t => tierLevels[t] <= currentTierLevel
    );
    
    // Get emotes for all accessible tiers
    const emotes = await Emote.find({
      type: 'subscriber',
      tier: { $in: accessibleTiers },
      approved: true
    }).lean();
    
    // Cache the results
    await redisClient.set(
      `emotes:tier:${tier}`,
      JSON.stringify(emotes),
      'EX',
      CACHE_TTL.TIER_EMOTES
    );
    
    return emotes;
  } catch (error) {
    logger.error(`Error fetching emotes for tier ${tier}:`, error);
    return [];
  }
}

/**
 * Get channel-specific emotes
 * @param {string} channelId Channel ID
 * @returns {Promise<Array>} Array of channel emotes
 */
async function getChannelEmotes(channelId) {
  try {
    // Try to get from cache first
    const cachedEmotes = await redisClient.get(`emotes:channel:${channelId}`);
    if (cachedEmotes) {
      return JSON.parse(cachedEmotes);
    }
    
    // Get emotes for the channel
    const emotes = await Emote.find({
      type: 'channel',
      channelId,
      approved: true
    }).lean();
    
    // Cache the results
    await redisClient.set(
      `emotes:channel:${channelId}`,
      JSON.stringify(emotes),
      'EX',
      CACHE_TTL.CHANNEL_EMOTES
    );
    
    return emotes;
  } catch (error) {
    logger.error(`Error fetching emotes for channel ${channelId}:`, error);
    return [];
  }
}

/**
 * Add a new emote
 * @param {Object} emoteData Emote data
 * @returns {Promise<Object>} Created emote
 */
async function addEmote(emoteData) {
  try {
    // Validate emote data
    if (!emoteData.code || !emoteData.url) {
      throw new Error('Emote code and URL are required');
    }
    
    // Check if emote code already exists
    const existingEmote = await Emote.findOne({ code: emoteData.code });
    if (existingEmote) {
      throw new Error(`Emote code "${emoteData.code}" already exists`);
    }
    
    // Create new emote
    const emote = new Emote({
      ...emoteData,
      approved: emoteData.type === 'global' ? false : true // Global emotes require approval
    });
    
    await emote.save();
    
    // Invalidate relevant caches
    if (emote.type === 'global') {
      await redisClient.del('emotes:global');
    } else if (emote.type === 'subscriber') {
      await redisClient.del(`emotes:tier:${emote.tier}`);
    } else if (emote.type === 'channel' && emote.channelId) {
      await redisClient.del(`emotes:channel:${emote.channelId}`);
    }
    
    return emote;
  } catch (error) {
    logger.error('Error adding emote:', error);
    throw error;
  }
}

/**
 * Remove an emote
 * @param {string} emoteId Emote ID
 * @returns {Promise<boolean>} Success status
 */
async function removeEmote(emoteId) {
  try {
    const emote = await Emote.findById(emoteId);
    if (!emote) {
      throw new Error('Emote not found');
    }
    
    await Emote.deleteOne({ _id: emoteId });
    
    // Invalidate relevant caches
    if (emote.type === 'global') {
      await redisClient.del('emotes:global');
    } else if (emote.type === 'subscriber') {
      await redisClient.del(`emotes:tier:${emote.tier}`);
    } else if (emote.type === 'channel' && emote.channelId) {
      await redisClient.del(`emotes:channel:${emote.channelId}`);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error removing emote ${emoteId}:`, error);
    throw error;
  }
}

/**
 * Update an emote
 * @param {string} emoteId Emote ID
 * @param {Object} updateData Update data
 * @returns {Promise<Object>} Updated emote
 */
async function updateEmote(emoteId, updateData) {
  try {
    const emote = await Emote.findById(emoteId);
    if (!emote) {
      throw new Error('Emote not found');
    }
    
    // Don't allow changing the code if it's already in use
    if (updateData.code && updateData.code !== emote.code) {
      const existingEmote = await Emote.findOne({ 
        code: updateData.code,
        _id: { $ne: emoteId }
      });
      
      if (existingEmote) {
        throw new Error(`Emote code "${updateData.code}" already exists`);
      }
    }
    
    // Update emote
    const updatedEmote = await Emote.findByIdAndUpdate(
      emoteId,
      {
        ...updateData,
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    // Invalidate relevant caches
    if (emote.type === 'global') {
      await redisClient.del('emotes:global');
    } else if (emote.type === 'subscriber') {
      await redisClient.del(`emotes:tier:${emote.tier}`);
    } else if (emote.type === 'channel' && emote.channelId) {
      await redisClient.del(`emotes:channel:${emote.channelId}`);
    }
    
    return updatedEmote;
  } catch (error) {
    logger.error(`Error updating emote ${emoteId}:`, error);
    throw error;
  }
}

/**
 * Clear emote caches
 * @returns {Promise<boolean>} Success status
 */
async function clearEmoteCaches() {
  try {
    // Get all emote cache keys
    const keys = await redisClient.keys('emotes:*');
    
    // Delete all emote caches
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    
    return true;
  } catch (error) {
    logger.error('Error clearing emote caches:', error);
    throw error;
  }
}

/**
 * Get default emotes for fallback
 * @returns {Array} Array of default emotes
 */
function getDefaultEmotes() {
  return [
    {
      id: 'smile',
      code: ':)',
      url: 'https://cdn.clipt.com/emotes/smile.png',
      type: 'global',
      tier: 'free',
      isAnimated: false,
      width: 28,
      height: 28
    },
    {
      id: 'sad',
      code: ':(',
      url: 'https://cdn.clipt.com/emotes/sad.png',
      type: 'global',
      tier: 'free',
      isAnimated: false,
      width: 28,
      height: 28
    },
    {
      id: 'laugh',
      code: ':D',
      url: 'https://cdn.clipt.com/emotes/laugh.png',
      type: 'global',
      tier: 'free',
      isAnimated: false,
      width: 28,
      height: 28
    },
    {
      id: 'heart',
      code: '<3',
      url: 'https://cdn.clipt.com/emotes/heart.png',
      type: 'global',
      tier: 'free',
      isAnimated: false,
      width: 28,
      height: 28
    },
    {
      id: 'kappa',
      code: 'Kappa',
      url: 'https://cdn.clipt.com/emotes/kappa.png',
      type: 'global',
      tier: 'free',
      isAnimated: false,
      width: 28,
      height: 28
    }
  ];
}

// Initialize default emotes
async function initializeDefaultEmotes() {
  try {
    // Check if we already have global emotes
    const existingCount = await Emote.countDocuments({ type: 'global' });
    if (existingCount > 0) {
      logger.info(`Found ${existingCount} existing global emotes`);
      return;
    }
    
    logger.info('Initializing default emotes');
    
    // Add default global emotes
    const defaultEmotes = getDefaultEmotes();
    await Emote.insertMany(defaultEmotes.map(emote => ({
      ...emote,
      approved: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })));
    
    logger.info(`Added ${defaultEmotes.length} default emotes`);
  } catch (error) {
    logger.error('Error initializing default emotes:', error);
  }
}

// Initialize subscription tier emotes
async function initializeTierEmotes() {
  try {
    // Check if we already have subscriber emotes
    const existingCount = await Emote.countDocuments({ type: 'subscriber' });
    if (existingCount > 0) {
      logger.info(`Found ${existingCount} existing subscriber emotes`);
      return;
    }
    
    logger.info('Initializing subscription tier emotes');
    
    // Define tier emotes
    const tierEmotes = [
      // Basic tier emotes
      {
        code: 'ProHype',
        url: 'https://cdn.clipt.com/emotes/tiers/basic/hype.gif',
        type: 'subscriber',
        tier: 'basic',
        isAnimated: true,
        width: 28,
        height: 28
      },
      {
        code: 'ProLove',
        url: 'https://cdn.clipt.com/emotes/tiers/basic/love.png',
        type: 'subscriber',
        tier: 'basic',
        isAnimated: false,
        width: 28,
        height: 28
      },
      {
        code: 'ProFlex',
        url: 'https://cdn.clipt.com/emotes/tiers/basic/flex.png',
        type: 'subscriber',
        tier: 'basic',
        isAnimated: false,
        width: 28,
        height: 28
      },
      
      // Premium tier emotes
      {
        code: 'MaxedLFG',
        url: 'https://cdn.clipt.com/emotes/tiers/premium/lfg.gif',
        type: 'subscriber',
        tier: 'premium',
        isAnimated: true,
        width: 28,
        height: 28
      },
      {
        code: 'MaxedCool',
        url: 'https://cdn.clipt.com/emotes/tiers/premium/cool.png',
        type: 'subscriber',
        tier: 'premium',
        isAnimated: false,
        width: 28,
        height: 28
      },
      {
        code: 'MaxedRage',
        url: 'https://cdn.clipt.com/emotes/tiers/premium/rage.gif',
        type: 'subscriber',
        tier: 'premium',
        isAnimated: true,
        width: 28,
        height: 28
      },
      
      // Annual tier emotes
      {
        code: 'AnnualVIP',
        url: 'https://cdn.clipt.com/emotes/tiers/annual/vip.gif',
        type: 'subscriber',
        tier: 'annual',
        isAnimated: true,
        width: 32,
        height: 32
      },
      {
        code: 'AnnualFire',
        url: 'https://cdn.clipt.com/emotes/tiers/annual/fire.gif',
        type: 'subscriber',
        tier: 'annual',
        isAnimated: true,
        width: 32,
        height: 32
      }
    ];
    
    await Emote.insertMany(tierEmotes.map(emote => ({
      ...emote,
      approved: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })));
    
    logger.info(`Added ${tierEmotes.length} tier emotes`);
  } catch (error) {
    logger.error('Error initializing tier emotes:', error);
  }
}

// Run initialization on module load
// initializeDefaultEmotes().then(() => initializeTierEmotes());

module.exports = {
  getGlobalEmotes,
  getUserEmotes,
  getTierEmotes,
  getChannelEmotes,
  addEmote,
  removeEmote,
  updateEmote,
  clearEmoteCaches,
  initializeDefaultEmotes,
  initializeTierEmotes
};
