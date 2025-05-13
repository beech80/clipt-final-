/**
 * EmoteSet Model
 * Allows grouping of emotes into collections for organization and access control
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const emoteSetSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['global', 'tier', 'channel', 'special'],
    default: 'global'
  },
  tier: {
    type: String,
    enum: ['free', 'pro', 'maxed', 'all'],
    default: 'free'
  },
  channelId: {
    type: Schema.Types.ObjectId,
    ref: 'Channel'
  },
  emotes: [{
    type: Schema.Types.ObjectId,
    ref: 'Emote'
  }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  active: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  accessRules: {
    subscribersOnly: {
      type: Boolean,
      default: false
    },
    moderatorsOnly: {
      type: Boolean,
      default: false
    },
    followersOnly: {
      type: Boolean,
      default: false
    },
    minimumTokens: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
emoteSetSchema.index({ type: 1, tier: 1, active: 1 });
emoteSetSchema.index({ channelId: 1, active: 1 });
emoteSetSchema.index({ featured: 1, displayOrder: 1 });

/**
 * Get global emote sets
 * @returns {Promise<Array>} Array of global emote sets
 */
emoteSetSchema.statics.getGlobalEmoteSets = async function() {
  return this.find({
    type: 'global',
    active: true
  })
  .sort({ displayOrder: 1 })
  .populate('emotes')
  .lean();
};

/**
 * Get emote sets for a specific tier
 * @param {String} tier - Subscription tier ('pro', 'maxed')
 * @returns {Promise<Array>} Array of tier emote sets
 */
emoteSetSchema.statics.getTierEmoteSets = async function(tier) {
  // Skip for free tier
  if (!tier || tier === 'free') {
    return [];
  }
  
  // For paid tiers, get all emote sets for this tier and lower tiers
  const tierLevels = {
    'pro': ['pro'],
    'maxed': ['pro', 'maxed']
  };
  
  const tiers = tierLevels[tier] || [];
  
  return this.find({
    type: 'tier',
    tier: { $in: [...tiers, 'all'] },
    active: true
  })
  .sort({ displayOrder: 1 })
  .populate('emotes')
  .lean();
};

/**
 * Get emote sets for a specific channel
 * @param {ObjectId} channelId - Channel ID
 * @returns {Promise<Array>} Array of channel emote sets
 */
emoteSetSchema.statics.getChannelEmoteSets = async function(channelId) {
  return this.find({
    type: 'channel',
    channelId,
    active: true
  })
  .sort({ displayOrder: 1 })
  .populate('emotes')
  .lean();
};

/**
 * Get featured emote sets
 * @param {Number} limit - Maximum number of results
 * @returns {Promise<Array>} Featured emote sets
 */
emoteSetSchema.statics.getFeaturedEmoteSets = async function(limit = 5) {
  return this.find({
    featured: true,
    active: true
  })
  .sort({ displayOrder: 1 })
  .limit(limit)
  .populate('emotes')
  .lean();
};

/**
 * Add emote to a set
 * @param {ObjectId} setId - EmoteSet ID
 * @param {ObjectId} emoteId - Emote ID
 * @returns {Promise<Boolean>} Success status
 */
emoteSetSchema.statics.addEmoteToSet = async function(setId, emoteId) {
  const result = await this.updateOne(
    { _id: setId },
    { $addToSet: { emotes: emoteId } }
  );
  
  return result.modifiedCount > 0;
};

/**
 * Remove emote from a set
 * @param {ObjectId} setId - EmoteSet ID
 * @param {ObjectId} emoteId - Emote ID
 * @returns {Promise<Boolean>} Success status
 */
emoteSetSchema.statics.removeEmoteFromSet = async function(setId, emoteId) {
  const result = await this.updateOne(
    { _id: setId },
    { $pull: { emotes: emoteId } }
  );
  
  return result.modifiedCount > 0;
};

/**
 * Create a new emote set
 * @param {Object} setData - EmoteSet data
 * @returns {Promise<Object>} Created emote set
 */
emoteSetSchema.statics.createEmoteSet = async function(setData) {
  const emoteSet = new this({
    name: setData.name,
    description: setData.description || '',
    type: setData.type || 'global',
    tier: setData.tier || 'free',
    channelId: setData.channelId,
    emotes: setData.emotes || [],
    createdBy: setData.createdBy,
    active: true,
    featured: setData.featured || false,
    displayOrder: setData.displayOrder || 0,
    accessRules: setData.accessRules || {
      subscribersOnly: false,
      moderatorsOnly: false,
      followersOnly: false,
      minimumTokens: 0
    }
  });
  
  await emoteSet.save();
  return emoteSet;
};

/**
 * Initialize default emote sets
 * @returns {Promise<Number>} Number of sets created
 */
emoteSetSchema.statics.initializeDefaultEmoteSets = async function() {
  // Get global emotes
  const Emote = mongoose.model('Emote');
  const globalEmotes = await Emote.find({ type: 'global', active: true }).lean();
  const proEmotes = await Emote.find({ type: 'tier', tier: 'pro', active: true }).lean();
  const maxedEmotes = await Emote.find({ type: 'tier', tier: 'maxed', active: true }).lean();
  
  const globalEmoteIds = globalEmotes.map(emote => emote._id);
  const proEmoteIds = proEmotes.map(emote => emote._id);
  const maxedEmoteIds = maxedEmotes.map(emote => emote._id);
  
  const defaultSets = [
    {
      name: 'Global Emotes',
      description: 'Basic emotes available to all users',
      type: 'global',
      tier: 'free',
      emotes: globalEmoteIds,
      active: true,
      featured: true,
      displayOrder: 0
    },
    {
      name: 'Pro Tier Emotes',
      description: 'Special emotes for Pro subscribers',
      type: 'tier',
      tier: 'pro',
      emotes: proEmoteIds,
      active: true,
      featured: true,
      displayOrder: 1,
      accessRules: {
        subscribersOnly: true
      }
    },
    {
      name: 'Maxed Tier Emotes',
      description: 'Premium emotes for Maxed subscribers',
      type: 'tier',
      tier: 'maxed',
      emotes: maxedEmoteIds,
      active: true,
      featured: true,
      displayOrder: 2,
      accessRules: {
        subscribersOnly: true
      }
    }
  ];
  
  const existingCount = await this.countDocuments({
    type: 'global'
  });
  
  if (existingCount > 0) {
    return 0; // Sets already exist
  }
  
  const result = await this.insertMany(defaultSets);
  return result.length;
};

// Create the model
const EmoteSet = mongoose.model('EmoteSet', emoteSetSchema);

module.exports = EmoteSet;
