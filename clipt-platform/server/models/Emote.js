/**
 * Emote Model
 * Represents chat emotes with their metadata and access control
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const emoteSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['global', 'tier', 'channel', 'custom'],
    default: 'global'
  },
  tier: {
    type: String,
    enum: ['free', 'pro', 'maxed', 'all'],
    default: 'free'
  },
  width: {
    type: Number,
    default: 28
  },
  height: {
    type: Number,
    default: 28
  },
  isAnimated: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: {
    type: String
  },
  active: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String
  }]
}, {
  timestamps: true
});

// Indexes for efficient querying
emoteSchema.index({ type: 1, tier: 1, active: 1 });
emoteSchema.index({ code: 1 }, { unique: true });
emoteSchema.index({ tags: 1 });
emoteSchema.index({ usageCount: -1 });

/**
 * Get global emotes
 * @returns {Promise<Array>} Array of global emotes
 */
emoteSchema.statics.getGlobalEmotes = async function() {
  return this.find({
    type: 'global',
    active: true,
    approved: true
  }).lean();
};

/**
 * Get emotes for a specific tier
 * @param {String} tier - Subscription tier ('pro', 'maxed')
 * @returns {Promise<Array>} Array of tier emotes
 */
emoteSchema.statics.getTierEmotes = async function(tier) {
  // Skip for free tier
  if (!tier || tier === 'free') {
    return [];
  }
  
  // For paid tiers, get all emotes for this tier and lower tiers
  const tierLevels = {
    'pro': ['pro'],
    'maxed': ['pro', 'maxed']
  };
  
  const tiers = tierLevels[tier] || [];
  
  return this.find({
    type: 'tier',
    tier: { $in: [...tiers, 'all'] },
    active: true,
    approved: true
  }).lean();
};

/**
 * Get emotes for a specific channel
 * @param {ObjectId} channelId - Channel ID
 * @returns {Promise<Array>} Array of channel emotes
 */
emoteSchema.statics.getChannelEmotes = async function(channelId) {
  return this.find({
    type: 'channel',
    channelId,
    active: true,
    approved: true
  }).lean();
};

/**
 * Search for emotes
 * @param {String} query - Search query
 * @param {Number} limit - Maximum number of results
 * @returns {Promise<Array>} Search results
 */
emoteSchema.statics.searchEmotes = async function(query, limit = 20) {
  const searchRegex = new RegExp(query, 'i');
  
  return this.find({
    $or: [
      { name: searchRegex },
      { code: searchRegex },
      { tags: searchRegex }
    ],
    active: true,
    approved: true
  })
  .sort({ usageCount: -1 })
  .limit(limit)
  .lean();
};

/**
 * Increment emote usage count
 * @param {String} code - Emote code
 * @returns {Promise<Boolean>} Success status
 */
emoteSchema.statics.incrementUsage = async function(code) {
  const result = await this.updateOne(
    { code },
    { $inc: { usageCount: 1 } }
  );
  
  return result.modifiedCount > 0;
};

/**
 * Get most popular emotes
 * @param {Number} limit - Maximum number of results
 * @returns {Promise<Array>} Popular emotes
 */
emoteSchema.statics.getPopularEmotes = async function(limit = 20) {
  return this.find({
    active: true,
    approved: true
  })
  .sort({ usageCount: -1 })
  .limit(limit)
  .lean();
};

/**
 * Submit a custom emote for approval
 * @param {Object} emoteData - Emote data
 * @returns {Promise<Object>} Created emote
 */
emoteSchema.statics.submitEmote = async function(emoteData) {
  const emote = new this({
    name: emoteData.name,
    code: emoteData.code,
    url: emoteData.url,
    type: emoteData.type || 'custom',
    tier: emoteData.tier || 'free',
    width: emoteData.width || 28,
    height: emoteData.height || 28,
    isAnimated: emoteData.isAnimated || false,
    createdBy: emoteData.createdBy,
    approved: false,
    active: true,
    tags: emoteData.tags || []
  });
  
  await emote.save();
  return emote;
};

/**
 * Approve an emote
 * @param {ObjectId} emoteId - Emote ID
 * @param {ObjectId} approvedBy - Admin ID
 * @returns {Promise<Object>} Updated emote
 */
emoteSchema.statics.approveEmote = async function(emoteId, approvedBy) {
  return this.findByIdAndUpdate(
    emoteId,
    {
      approved: true,
      approvedBy,
      rejectionReason: null
    },
    { new: true }
  );
};

/**
 * Reject an emote
 * @param {ObjectId} emoteId - Emote ID
 * @param {String} reason - Rejection reason
 * @returns {Promise<Object>} Updated emote
 */
emoteSchema.statics.rejectEmote = async function(emoteId, reason) {
  return this.findByIdAndUpdate(
    emoteId,
    {
      approved: false,
      rejectionReason: reason
    },
    { new: true }
  );
};

/**
 * Initialize default emotes
 * @returns {Promise<Number>} Number of emotes created
 */
emoteSchema.statics.initializeDefaultEmotes = async function() {
  const defaultEmotes = [
    {
      name: 'Smile',
      code: ':smile:',
      url: '/assets/emotes/smile.png',
      type: 'global',
      tier: 'free',
      isAnimated: false,
      approved: true,
      active: true,
      tags: ['happy', 'smile']
    },
    {
      name: 'LOL',
      code: ':lol:',
      url: '/assets/emotes/lol.png',
      type: 'global',
      tier: 'free',
      isAnimated: false,
      approved: true,
      active: true,
      tags: ['laugh', 'funny']
    },
    {
      name: 'Love',
      code: ':love:',
      url: '/assets/emotes/love.png',
      type: 'global',
      tier: 'free',
      isAnimated: false,
      approved: true,
      active: true,
      tags: ['love', 'heart']
    },
    {
      name: 'Clipt',
      code: ':clipt:',
      url: '/assets/emotes/clipt.png',
      type: 'global',
      tier: 'free',
      isAnimated: false,
      approved: true,
      active: true,
      tags: ['clipt', 'logo']
    },
    // Pro tier emotes
    {
      name: 'Pro Hype',
      code: ':prohype:',
      url: '/assets/emotes/pro_hype.gif',
      type: 'tier',
      tier: 'pro',
      isAnimated: true,
      approved: true,
      active: true,
      tags: ['hype', 'pro']
    },
    {
      name: 'Pro Cool',
      code: ':procool:',
      url: '/assets/emotes/pro_cool.png',
      type: 'tier',
      tier: 'pro',
      isAnimated: false,
      approved: true,
      active: true,
      tags: ['cool', 'pro']
    },
    // Maxed tier emotes
    {
      name: 'Maxed Fire',
      code: ':maxedfire:',
      url: '/assets/emotes/maxed_fire.gif',
      type: 'tier',
      tier: 'maxed',
      isAnimated: true,
      approved: true,
      active: true,
      tags: ['fire', 'maxed']
    },
    {
      name: 'Maxed King',
      code: ':maxedking:',
      url: '/assets/emotes/maxed_king.gif',
      type: 'tier',
      tier: 'maxed',
      isAnimated: true,
      approved: true,
      active: true,
      tags: ['king', 'maxed']
    }
  ];
  
  const existingCount = await this.countDocuments({
    type: 'global'
  });
  
  if (existingCount > 0) {
    return 0; // Emotes already exist
  }
  
  const result = await this.insertMany(defaultEmotes);
  return result.length;
};

// Create the model
const Emote = mongoose.model('Emote', emoteSchema);

module.exports = Emote;
