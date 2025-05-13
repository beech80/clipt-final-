/**
 * Chat Message Model
 * Stores chat messages with their content, metadata, and relations
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatMessageSchema = new Schema({
  roomId: {
    type: Schema.Types.ObjectId,
    ref: 'Channel',
    required: true,
    index: true
  },
  user: {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    tier: {
      type: String,
      enum: ['free', 'pro', 'maxed'],
      default: 'free'
    },
    badges: [{
      type: String
    }],
    isModerator: {
      type: Boolean,
      default: false
    },
    isAdmin: {
      type: Boolean,
      default: false
    }
  },
  content: {
    type: String,
    required: true
  },
  parsedContent: {
    type: String,
    default: ''
  },
  emotes: [{
    id: String,
    code: String,
    url: String,
    width: Number,
    height: Number
  }],
  type: {
    type: String,
    enum: ['text', 'donation', 'action', 'system', 'moderation'],
    default: 'text'
  },
  amount: {
    type: Number,
    default: 0
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
chatMessageSchema.index({ roomId: 1, createdAt: -1 });
chatMessageSchema.index({ 'user.userId': 1, roomId: 1 });

// TTL index for auto-deletion after 30 days
chatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

/**
 * Get messages for a room
 * @param {ObjectId} roomId - Room ID
 * @param {Number} limit - Maximum number of messages to return
 * @param {Date} before - Get messages before this timestamp
 * @returns {Promise<Array>} Messages
 */
chatMessageSchema.statics.getRoomMessages = async function(roomId, limit = 50, before = null) {
  const query = {
    roomId,
    isDeleted: false
  };
  
  if (before) {
    query.createdAt = { $lt: before };
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get messages by user
 * @param {ObjectId} userId - User ID
 * @param {Number} limit - Maximum number of messages to return
 * @returns {Promise<Array>} Messages
 */
chatMessageSchema.statics.getUserMessages = async function(userId, limit = 50) {
  return this.find({
    'user.userId': userId,
    isDeleted: false
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Delete messages by user in room
 * @param {ObjectId} roomId - Room ID
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} deletedBy - ID of user who deleted the messages
 * @returns {Promise<Number>} Number of messages deleted
 */
chatMessageSchema.statics.deleteUserMessages = async function(roomId, userId, deletedBy) {
  const result = await this.updateMany(
    { roomId, 'user.userId': userId, isDeleted: false },
    { isDeleted: true, deletedBy }
  );
  
  return result.modifiedCount;
};

// Create model
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;
