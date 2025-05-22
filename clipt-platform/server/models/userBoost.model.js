const mongoose = require('mongoose');

/**
 * UserBoost Schema
 * Tracks individual boost purchases and activations
 */
const userBoostSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  boostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boost',
    required: true,
    index: true
  },
  // Boost details at time of purchase (to preserve history)
  boostDetails: {
    name: String,
    description: String,
    price: Number,
    category: String,
    duration: Number,
    effectMultiplier: Number,
    effectDetails: mongoose.Schema.Types.Mixed
  },
  // Status tracking
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  purchasedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
  },
  activatedAt: {
    type: Date,
    default: Date.now
  },
  deactivatedAt: {
    type: Date
  },
  // Additional tracking details
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  usageCount: {
    type: Number,
    default: 0
  },
  usageLimit: {
    type: Number,
    default: -1 // -1 means unlimited
  },
  lastUsedAt: {
    type: Date
  },
  // Admin capabilities
  manuallyDeactivated: {
    type: Boolean,
    default: false
  },
  deactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String
  }
}, {
  timestamps: {
    createdAt: 'purchasedAt',
    updatedAt: false // We track specific state changes instead
  }
});

// Define compound indexes for performance
userBoostSchema.index({ userId: 1, isActive: 1 });
userBoostSchema.index({ userId: 1, boostId: 1, isActive: 1 });
userBoostSchema.index({ expiresAt: 1, isActive: 1 }); // For expiration checking

// Check if a boost is expired but not yet marked as inactive
userBoostSchema.methods.checkExpiration = function() {
  if (!this.isActive) return false;
  
  // Permanently active boost
  if (!this.expiresAt) return false;
  
  // Check if expired
  const now = new Date();
  return now >= this.expiresAt;
};

// Deactivate a boost
userBoostSchema.methods.deactivate = async function(adminId = null, reason = null) {
  if (!this.isActive) return false;
  
  this.isActive = false;
  this.deactivatedAt = new Date();
  
  if (adminId) {
    this.manuallyDeactivated = true;
    this.deactivatedBy = adminId;
    this.notes = reason || 'Manually deactivated by admin';
  } else {
    this.notes = reason || 'Expired';
  }
  
  await this.save();
  return true;
};

// Increment usage count
userBoostSchema.methods.recordUsage = async function() {
  if (!this.isActive) return false;
  
  // Check expiration first
  if (this.checkExpiration()) {
    await this.deactivate(null, 'Expired');
    return false;
  }
  
  // Check usage limit if applicable
  if (this.usageLimit > 0 && this.usageCount >= this.usageLimit) {
    await this.deactivate(null, 'Usage limit reached');
    return false;
  }
  
  // Record usage
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  await this.save();
  
  // If this usage reached the limit, deactivate
  if (this.usageLimit > 0 && this.usageCount >= this.usageLimit) {
    await this.deactivate(null, 'Usage limit reached');
  }
  
  return true;
};

// Static method to create a new user boost
userBoostSchema.statics.createUserBoost = async function(userId, boost, transactionId = null) {
  // Calculate expiration if applicable
  let expiresAt = null;
  if (boost.duration > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + boost.duration);
  }
  
  // Create the user boost record
  const userBoost = await this.create({
    userId,
    boostId: boost._id,
    boostDetails: {
      name: boost.name,
      description: boost.description,
      price: boost.price,
      category: boost.category,
      duration: boost.duration,
      effectMultiplier: boost.effectMultiplier,
      effectDetails: boost.effectDetails
    },
    isActive: true,
    purchasedAt: new Date(),
    expiresAt,
    activatedAt: new Date(),
    transactionId,
    usageLimit: boost.effectDetails?.usageLimit || -1
  });
  
  return userBoost;
};

// Static method to get a user's active boosts
userBoostSchema.statics.getUserActiveBoosts = async function(userId) {
  const boosts = await this.find({ 
    userId, 
    isActive: true 
  }).populate('boostId');
  
  // Check for any expired boosts and deactivate them
  const now = new Date();
  const promises = [];
  
  for (const boost of boosts) {
    if (boost.expiresAt && now >= boost.expiresAt) {
      promises.push(boost.deactivate(null, 'Expired'));
    }
  }
  
  // If any boosts were deactivated, re-fetch the list
  if (promises.length > 0) {
    await Promise.all(promises);
    return await this.find({ 
      userId, 
      isActive: true 
    }).populate('boostId');
  }
  
  return boosts;
};

// Static method to check if a user has a specific active boost
userBoostSchema.statics.hasActiveBoost = async function(userId, boostIdOrCategory) {
  const query = { 
    userId, 
    isActive: true 
  };
  
  // Allow checking by boost ID or category
  if (mongoose.Types.ObjectId.isValid(boostIdOrCategory)) {
    query.boostId = boostIdOrCategory;
  } else {
    query['boostDetails.category'] = boostIdOrCategory;
  }
  
  const count = await this.countDocuments(query);
  return count > 0;
};

// Static method to get a user's boost history with pagination
userBoostSchema.statics.getUserBoostHistory = async function(userId, { 
  page = 1, 
  limit = 20, 
  isActive = null, 
  category = null 
}) {
  // Build query
  const query = { userId };
  
  if (isActive !== null) {
    query.isActive = isActive;
  }
  
  if (category) {
    query['boostDetails.category'] = category;
  }
  
  // Execute query with pagination
  const skip = (page - 1) * limit;
  
  const [boosts, totalCount] = await Promise.all([
    this.find(query)
      .sort({ purchasedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('boostId')
      .lean(),
    this.countDocuments(query)
  ]);
  
  // Calculate total pages
  const totalPages = Math.ceil(totalCount / limit);
  
  return {
    boosts,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

const UserBoost = mongoose.model('UserBoost', userBoostSchema);

module.exports = UserBoost;
