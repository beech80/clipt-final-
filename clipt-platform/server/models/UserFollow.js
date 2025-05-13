/**
 * User Follow Model
 * Tracks user follows for channels and enables followers-only chat mode
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userFollowSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  followingId: {
    type: Schema.Types.ObjectId,
    ref: 'Channel',
    required: true,
    index: true
  },
  notificationsEnabled: {
    type: Boolean,
    default: true
  },
  followStrength: {
    type: Number,
    default: 1,
    min: 0,
    max: 10,
    description: 'Algorithmic weight for recommendations (increased by watch time and interactions)'
  },
  followerRank: {
    type: String,
    enum: ['new', 'regular', 'loyal', 'superfan'],
    default: 'new',
    description: 'Status based on engagement metrics'
  },
  lastInteractionDate: {
    type: Date,
    default: Date.now
  },
  watchTime: {
    type: Number,
    default: 0,
    description: 'Total minutes watched'
  },
  engagementMetrics: {
    chatMessages: {
      type: Number,
      default: 0
    },
    donations: {
      type: Number,
      default: 0
    },
    donationAmount: {
      type: Number,
      default: 0
    },
    reactions: {
      type: Number,
      default: 0
    },
    clipsCreated: {
      type: Number,
      default: 0
    },
    clipsShared: {
      type: Number,
      default: 0
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for efficient lookups and enforcing uniqueness
userFollowSchema.index({ userId: 1, followingId: 1 }, { unique: true });

// Create index for getting followers of a channel
userFollowSchema.index({ followingId: 1, createdAt: -1 });

// Create index for sorting by engagement
userFollowSchema.index({ followingId: 1, followerRank: 1 });

/**
 * Check if a user is following a channel
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} channelId - Channel ID
 * @returns {Promise<Boolean>} True if following
 */
userFollowSchema.statics.isFollowing = async function(userId, channelId) {
  const follow = await this.findOne({
    userId,
    followingId: channelId
  });
  
  return !!follow;
};

/**
 * Follow a channel
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} channelId - Channel ID
 * @returns {Promise<Object>} Created follow document
 */
userFollowSchema.statics.followChannel = async function(userId, channelId) {
  // Check if already following
  const existingFollow = await this.findOne({
    userId,
    followingId: channelId
  });
  
  if (existingFollow) {
    return existingFollow;
  }
  
  // Create new follow relationship
  return this.create({
    userId,
    followingId: channelId,
    notificationsEnabled: true,
    followStrength: 1,
    followerRank: 'new',
    lastInteractionDate: new Date(),
    watchTime: 0,
    engagementMetrics: {
      chatMessages: 0,
      donations: 0,
      donationAmount: 0,
      reactions: 0,
      clipsCreated: 0,
      clipsShared: 0
    }
  });
};

/**
 * Unfollow a channel
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} channelId - Channel ID
 * @returns {Promise<Boolean>} True if successful
 */
userFollowSchema.statics.unfollowChannel = async function(userId, channelId) {
  const result = await this.deleteOne({
    userId,
    followingId: channelId
  });
  
  return result.deletedCount > 0;
};

/**
 * Get a user's followed channels
 * @param {ObjectId} userId - User ID
 * @param {Number} limit - Maximum number of channels to return
 * @param {Number} skip - Number of channels to skip
 * @returns {Promise<Array>} List of followed channels
 */
userFollowSchema.statics.getUserFollowedChannels = async function(userId, limit = 20, skip = 0) {
  return this.find({ userId })
    .sort({ lastInteractionDate: -1 })
    .skip(skip)
    .limit(limit)
    .populate('followingId', 'displayName username profileImage isLive')
    .lean();
};

/**
 * Get a channel's followers
 * @param {ObjectId} channelId - Channel ID
 * @param {Number} limit - Maximum number of followers to return
 * @param {Number} skip - Number of followers to skip
 * @returns {Promise<Array>} List of followers
 */
userFollowSchema.statics.getChannelFollowers = async function(channelId, limit = 20, skip = 0) {
  return this.find({ followingId: channelId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'username profileImage')
    .lean();
};

/**
 * Get a channel's top followers by engagement
 * @param {ObjectId} channelId - Channel ID
 * @param {Number} limit - Maximum number of followers to return
 * @returns {Promise<Array>} List of top followers
 */
userFollowSchema.statics.getChannelTopFollowers = async function(channelId, limit = 10) {
  return this.find({ 
    followingId: channelId,
    followerRank: { $in: ['loyal', 'superfan'] }
  })
    .sort({ 
      followerRank: -1, 
      'engagementMetrics.donationAmount': -1,
      'engagementMetrics.chatMessages': -1,
      watchTime: -1
    })
    .limit(limit)
    .populate('userId', 'username profileImage')
    .lean();
};

/**
 * Update follow engagement metrics
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} channelId - Channel ID
 * @param {Object} metrics - Metrics to update
 * @returns {Promise<Object>} Updated follow document
 */
userFollowSchema.statics.updateEngagement = async function(userId, channelId, metrics) {
  const updates = {};
  const now = new Date();
  
  // Set last interaction date
  updates.lastInteractionDate = now;
  
  // Increment metrics based on provided data
  if (metrics.chatMessage) {
    updates['engagementMetrics.chatMessages'] = 1;
  }
  
  if (metrics.donation) {
    updates['engagementMetrics.donations'] = 1;
    updates['engagementMetrics.donationAmount'] = metrics.donationAmount || 0;
  }
  
  if (metrics.reaction) {
    updates['engagementMetrics.reactions'] = 1;
  }
  
  if (metrics.clipCreated) {
    updates['engagementMetrics.clipsCreated'] = 1;
  }
  
  if (metrics.clipShared) {
    updates['engagementMetrics.clipsShared'] = 1;
  }
  
  if (metrics.watchTimeMinutes) {
    updates.watchTime = metrics.watchTimeMinutes;
  }
  
  // Calculate new follower rank based on all engagement metrics
  const follow = await this.findOne({ userId, followingId: channelId });
  
  if (follow) {
    const newEngagementMetrics = {
      chatMessages: follow.engagementMetrics.chatMessages + (metrics.chatMessage ? 1 : 0),
      donations: follow.engagementMetrics.donations + (metrics.donation ? 1 : 0),
      donationAmount: follow.engagementMetrics.donationAmount + (metrics.donationAmount || 0),
      reactions: follow.engagementMetrics.reactions + (metrics.reaction ? 1 : 0),
      clipsCreated: follow.engagementMetrics.clipsCreated + (metrics.clipCreated ? 1 : 0),
      clipsShared: follow.engagementMetrics.clipsShared + (metrics.clipShared ? 1 : 0)
    };
    
    const newWatchTime = follow.watchTime + (metrics.watchTimeMinutes || 0);
    
    // Calculate engagement score
    const engagementScore = 
      newWatchTime * 0.1 + 
      newEngagementMetrics.chatMessages * 2 + 
      newEngagementMetrics.donations * 5 +
      newEngagementMetrics.donationAmount * 0.1 +
      newEngagementMetrics.reactions +
      newEngagementMetrics.clipsCreated * 3 +
      newEngagementMetrics.clipsShared * 2;
    
    // Determine rank based on score
    let newRank = 'new';
    if (engagementScore > 1000) {
      newRank = 'superfan';
    } else if (engagementScore > 500) {
      newRank = 'loyal';
    } else if (engagementScore > 100) {
      newRank = 'regular';
    }
    
    updates.followerRank = newRank;
    updates.followStrength = Math.min(10, Math.floor(engagementScore / 100));
  }
  
  return this.findOneAndUpdate(
    { userId, followingId: channelId },
    { $inc: updates, $set: { updatedAt: now } },
    { new: true, upsert: true }
  );
};

/**
 * Get follower count for a channel
 * @param {ObjectId} channelId - Channel ID
 * @returns {Promise<Number>} Follower count
 */
userFollowSchema.statics.getFollowerCount = async function(channelId) {
  return this.countDocuments({ followingId: channelId });
};

// Create model
const UserFollow = mongoose.model('UserFollow', userFollowSchema);

module.exports = UserFollow;
