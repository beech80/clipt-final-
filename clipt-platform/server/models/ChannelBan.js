/**
 * Channel Ban Model
 * Tracks banned users for each channel
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const channelBanSchema = new Schema({
  channelId: {
    type: Schema.Types.ObjectId,
    ref: 'Channel',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bannedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  reason: {
    type: String,
    default: ''
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  expireAt: {
    type: Date,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for efficient lookups
channelBanSchema.index({ channelId: 1, userId: 1 }, { unique: true });

/**
 * Check if a user is banned in a channel
 * @param {ObjectId} channelId - Channel ID
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Boolean>} True if banned
 */
channelBanSchema.statics.isUserBanned = async function(channelId, userId) {
  const now = new Date();
  
  const ban = await this.findOne({
    channelId,
    userId,
    active: true,
    $or: [
      { expireAt: { $gt: now } },
      { expireAt: null }
    ]
  });
  
  return !!ban;
};

/**
 * Ban a user from a channel
 * @param {ObjectId} channelId - Channel ID
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} bannedBy - Moderator ID
 * @param {String} reason - Ban reason
 * @param {Date} expireAt - Ban expiration date (null for permanent)
 * @returns {Promise<Object>} Created ban document
 */
channelBanSchema.statics.banUser = async function(channelId, userId, bannedBy, reason = '', expireAt = null) {
  // Check if user is already banned
  const existingBan = await this.findOne({ channelId, userId });
  
  if (existingBan) {
    // Update existing ban
    existingBan.active = true;
    existingBan.bannedBy = bannedBy;
    existingBan.reason = reason || existingBan.reason;
    existingBan.expireAt = expireAt;
    existingBan.updatedAt = new Date();
    
    return existingBan.save();
  }
  
  // Create new ban
  return this.create({
    channelId,
    userId,
    bannedBy,
    reason,
    active: true,
    expireAt
  });
};

/**
 * Unban a user from a channel
 * @param {ObjectId} channelId - Channel ID
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Boolean>} True if successful
 */
channelBanSchema.statics.unbanUser = async function(channelId, userId) {
  const result = await this.updateOne(
    { channelId, userId },
    { active: false }
  );
  
  return result.modifiedCount > 0;
};

/**
 * Get all active bans for a channel
 * @param {ObjectId} channelId - Channel ID
 * @returns {Promise<Array>} List of active bans
 */
channelBanSchema.statics.getChannelBans = async function(channelId) {
  const now = new Date();
  
  return this.find({
    channelId,
    active: true,
    $or: [
      { expireAt: { $gt: now } },
      { expireAt: null }
    ]
  })
  .populate('userId', 'username profileImage')
  .populate('bannedBy', 'username')
  .sort({ createdAt: -1 })
  .lean();
};

// Create model
const ChannelBan = mongoose.model('ChannelBan', channelBanSchema);

module.exports = ChannelBan;
