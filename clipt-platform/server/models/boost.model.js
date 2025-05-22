const mongoose = require('mongoose');

/**
 * Boost Schema - Defines purchasable items in the token economy
 * These are the items users can spend their tokens on
 */
const boostSchema = new mongoose.Schema({
  // Basic boost information
  name: {
    type: String,
    required: [true, 'Boost name is required'],
    trim: true,
    unique: true
  },
  description: {
    type: String,
    required: [true, 'Boost description is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Boost price is required'],
    min: [0, 'Price cannot be negative']
  },
  category: {
    type: String,
    required: true,
    enum: ['appearance', 'visibility', 'content', 'earnings', 'interaction', 'special'],
    index: true
  },
  image: {
    type: String,
    default: 'https://placehold.co/200x200/purple/white?text=BOOST'
  },
  // Availability and timing
  isActive: {
    type: Boolean,
    default: true
  },
  duration: {
    type: Number,
    required: true,
    min: [-1, 'Duration must be >= -1 (-1 means permanent)'],
    description: 'Duration in days, -1 for permanent'
  },
  tierRequired: {
    type: String,
    enum: ['free', 'basic', 'premium', 'annual'],
    default: 'free',
    description: 'Minimum subscription tier required to purchase'
  },
  // Inventory management
  stockLimit: {
    type: Number,
    default: -1,
    description: 'Maximum number available, -1 for unlimited'
  },
  currentStock: {
    type: Number,
    default: -1
  },
  // Time-limited availability
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  // Usage limits
  maxPerUser: {
    type: Number,
    default: -1,
    description: 'Maximum purchases per user, -1 for unlimited'
  },
  cooldownPeriod: {
    type: Number,
    default: 0,
    description: 'Hours before a user can purchase this boost again'
  },
  // Special effect tracking
  effectMultiplier: {
    type: Number,
    default: 1,
    description: 'For boosts that multiply earnings, etc.'
  },
  effectDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    description: 'Additional configuration for the boost effect'
  },
  // Admin and tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  purchaseCount: {
    type: Number,
    default: 0
  },
  activeUsers: {
    type: Number,
    default: 0
  },
  // Standard timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

// Define indexes
boostSchema.index({ category: 1, price: 1 });
boostSchema.index({ tierRequired: 1 });
boostSchema.index({ isActive: 1 });

// Check if boost is currently available
boostSchema.methods.isAvailable = function() {
  if (!this.isActive) return false;
  
  const now = new Date();
  
  // Check time-limited availability
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  
  // Check stock if limited
  if (this.stockLimit > 0 && this.currentStock <= 0) return false;
  
  return true;
};

// Update stock when purchased
boostSchema.methods.updateStock = async function() {
  if (this.stockLimit > 0 && this.currentStock > 0) {
    this.currentStock--;
  }
  
  this.purchaseCount++;
  this.activeUsers++;
  
  await this.save();
};

// Get all available boosts with filters
boostSchema.statics.getAvailableBoosts = async function(filters = {}) {
  const { 
    category, 
    tierRequired, 
    minPrice, 
    maxPrice, 
    searchTerm 
  } = filters;
  
  // Build query
  const query = { isActive: true };
  
  // Apply filters
  if (category) query.category = category;
  if (tierRequired) query.tierRequired = tierRequired;
  
  // Price range
  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined) query.price.$gte = minPrice;
    if (maxPrice !== undefined) query.price.$lte = maxPrice;
  }
  
  // Date-based availability
  const now = new Date();
  query.$or = [
    { startDate: null },
    { startDate: { $lte: now } }
  ];
  query.$or.push(
    { endDate: null },
    { endDate: { $gte: now } }
  );
  
  // Stock-based availability
  query.$or.push(
    { stockLimit: -1 },
    { currentStock: { $gt: 0 } }
  );
  
  // Text search
  if (searchTerm) {
    query.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } }
    ];
  }
  
  return await this.find(query).sort({ price: 1 });
};

const Boost = mongoose.model('Boost', boostSchema);

module.exports = Boost;
