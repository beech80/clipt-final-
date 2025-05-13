/**
 * Channel Moderator Model
 * Tracks moderators for each channel with their specific permissions
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const channelModeratorSchema = new Schema({
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
  addedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  permissions: {
    canBan: {
      type: Boolean,
      default: true
    },
    canTimeout: {
      type: Boolean,
      default: true
    },
    canDeleteMessages: {
      type: Boolean,
      default: true
    },
    canManageMods: {
      type: Boolean,
      default: false
    },
    canChangeChatMode: {
      type: Boolean,
      default: true
    }
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for efficient lookups
channelModeratorSchema.index({ channelId: 1, userId: 1 }, { unique: true });

/**
 * Check if a user is a moderator for a channel
 * @param {ObjectId} channelId - Channel ID
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Boolean>} True if moderator
 */
channelModeratorSchema.statics.isUserModerator = async function(channelId, userId) {
  const moderator = await this.findOne({
    channelId,
    userId,
    active: true
  });
  
  return !!moderator;
};

/**
 * Get a moderator's permissions for a channel
 * @param {ObjectId} channelId - Channel ID
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object|null>} Moderator permissions or null if not a moderator
 */
channelModeratorSchema.statics.getModeratorPermissions = async function(channelId, userId) {
  const moderator = await this.findOne({
    channelId,
    userId,
    active: true
  }).lean();
  
  return moderator ? moderator.permissions : null;
};

/**
 * Add a moderator to a channel
 * @param {ObjectId} channelId - Channel ID
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} addedBy - Channel owner or admin ID
 * @param {Object} permissions - Moderator permissions
 * @returns {Promise<Object>} Created moderator document
 */
channelModeratorSchema.statics.addModerator = async function(channelId, userId, addedBy, permissions = {}) {
  // Check if user is already a moderator
  const existingMod = await this.findOne({ channelId, userId });
  
  if (existingMod) {
    // Update existing moderator
    existingMod.active = true;
    existingMod.addedBy = addedBy;
    existingMod.permissions = {
      ...existingMod.permissions,
      ...permissions
    };
    existingMod.updatedAt = new Date();
    
    return existingMod.save();
  }
  
  // Create new moderator
  return this.create({
    channelId,
    userId,
    addedBy,
    permissions: {
      canBan: true,
      canTimeout: true,
      canDeleteMessages: true,
      canManageMods: false,
      canChangeChatMode: true,
      ...permissions
    },
    active: true
  });
};

/**
 * Remove a moderator from a channel
 * @param {ObjectId} channelId - Channel ID
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Boolean>} True if successful
 */
channelModeratorSchema.statics.removeModerator = async function(channelId, userId) {
  const result = await this.updateOne(
    { channelId, userId },
    { active: false }
  );
  
  return result.modifiedCount > 0;
};

/**
 * Get all active moderators for a channel
 * @param {ObjectId} channelId - Channel ID
 * @returns {Promise<Array>} List of active moderators
 */
channelModeratorSchema.statics.getChannelModerators = async function(channelId) {
  return this.find({
    channelId,
    active: true
  })
  .populate('userId', 'username profileImage')
  .populate('addedBy', 'username')
  .sort({ createdAt: -1 })
  .lean();
};

/**
 * Update moderator permissions
 * @param {ObjectId} channelId - Channel ID
 * @param {ObjectId} userId - User ID
 * @param {Object} permissions - New permissions
 * @returns {Promise<Object|null>} Updated moderator document or null if not found
 */
channelModeratorSchema.statics.updatePermissions = async function(channelId, userId, permissions) {
  return this.findOneAndUpdate(
    { channelId, userId, active: true },
    { 
      $set: { 
        "permissions": permissions,
        "updatedAt": new Date() 
      } 
    },
    { new: true }
  );
};

// Create model
const ChannelModerator = mongoose.model('ChannelModerator', channelModeratorSchema);

module.exports = ChannelModerator;
