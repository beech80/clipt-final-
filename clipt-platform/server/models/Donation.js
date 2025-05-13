/**
 * Donation Model
 * Tracks token donations in the chat system
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const donationSchema = new Schema({
  roomId: {
    type: Schema.Types.ObjectId,
    ref: 'Channel',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  message: {
    type: String,
    default: ''
  },
  effectType: {
    type: String,
    enum: ['regular', 'highlighted', 'animated', 'super'],
    default: 'regular'
  },
  status: {
    type: String,
    enum: ['completed', 'refunded', 'failed'],
    default: 'completed'
  },
  refundReason: {
    type: String
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
donationSchema.index({ roomId: 1, createdAt: -1 });
donationSchema.index({ userId: 1, createdAt: -1 });

/**
 * Get user's donation history
 * @param {ObjectId} userId - User ID
 * @param {Number} limit - Maximum number of donations to return
 * @returns {Promise<Array>} Donations
 */
donationSchema.statics.getUserDonations = async function(userId, limit = 20) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get channel's donation history
 * @param {ObjectId} roomId - Room/Channel ID
 * @param {Number} limit - Maximum number of donations to return
 * @returns {Promise<Array>} Donations
 */
donationSchema.statics.getChannelDonations = async function(roomId, limit = 50) {
  return this.find({ roomId, status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get total donations for a channel
 * @param {ObjectId} roomId - Room/Channel ID
 * @returns {Promise<Number>} Total donation amount
 */
donationSchema.statics.getChannelTotalDonations = async function(roomId) {
  const result = await this.aggregate([
    { $match: { roomId, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  
  return result.length > 0 ? result[0].total : 0;
};

/**
 * Get top donors for a channel
 * @param {ObjectId} roomId - Room/Channel ID
 * @param {Number} limit - Maximum number of donors to return
 * @returns {Promise<Array>} Top donors with total amounts
 */
donationSchema.statics.getChannelTopDonors = async function(roomId, limit = 10) {
  return this.aggregate([
    { $match: { roomId, status: 'completed' } },
    { $group: { 
      _id: '$userId', 
      username: { $first: '$username' },
      total: { $sum: '$amount' },
      count: { $sum: 1 },
      lastDonation: { $max: '$createdAt' }
    }},
    { $sort: { total: -1 } },
    { $limit: limit }
  ]);
};

/**
 * Refund a donation
 * @param {ObjectId} donationId - Donation ID
 * @param {String} reason - Refund reason
 * @returns {Promise<Object>} Updated donation
 */
donationSchema.statics.refundDonation = async function(donationId, reason) {
  return this.findByIdAndUpdate(
    donationId,
    { 
      status: 'refunded',
      refundReason: reason 
    },
    { new: true }
  );
};

// Create model
const Donation = mongoose.model('Donation', donationSchema);

module.exports = Donation;
