const mongoose = require('mongoose');

/**
 * Subscription Schema
 * Manages user subscription tiers and payment tracking
 */
const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  // Tier information
  tierId: {
    type: String,
    enum: ['free', 'basic', 'premium', 'annual'],
    required: true,
    default: 'free',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'expired', 'past_due', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid'],
    default: 'active',
    index: true
  },
  // Timeframe
  startDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  endDate: {
    type: Date,
    index: true
  },
  renewalDate: {
    type: Date,
    index: true
  },
  trialEndDate: {
    type: Date
  },
  canceledAt: {
    type: Date
  },
  // Billing details
  price: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  interval: {
    type: String,
    enum: ['month', 'year', 'week', 'day'],
    default: 'month'
  },
  // Payment provider info
  stripeCustomerId: {
    type: String,
    index: true
  },
  stripeSubscriptionId: {
    type: String,
    index: true
  },
  stripePaymentMethodId: {
    type: String
  },
  // Features and limits
  features: {
    type: [String],
    default: []
  },
  tokenMultiplier: {
    type: Number,
    default: 1,
    min: 0.1
  },
  tokenDailyLimit: {
    type: Number,
    default: 500,
    min: 0
  },
  // Tracking 
  hasCanceled: {
    type: Boolean,
    default: false
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  paymentHistory: [{
    paymentId: String,
    amount: Number,
    currency: String,
    status: {
      type: String,
      enum: ['succeeded', 'failed', 'pending', 'refunded']
    },
    date: Date,
    errorMessage: String
  }],
  // Admin capabilities
  isComplimentary: {
    type: Boolean,
    default: false
  },
  adminNotes: {
    type: String
  },
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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

// Get subscription details
subscriptionSchema.methods.getDetails = function() {
  const now = new Date();
  
  // Calculate days remaining in current period
  let daysRemaining = 0;
  if (this.renewalDate && this.status === 'active') {
    const diffTime = Math.abs(this.renewalDate - now);
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  return {
    id: this._id,
    userId: this.userId,
    tierId: this.tierId,
    status: this.status,
    startDate: this.startDate,
    renewalDate: this.renewalDate,
    endDate: this.endDate,
    canceledAt: this.canceledAt,
    price: this.price,
    currency: this.currency,
    interval: this.interval,
    hasCanceled: this.hasCanceled,
    autoRenew: this.autoRenew,
    isActive: this.status === 'active',
    isTrialing: this.status === 'trialing',
    daysRemaining: daysRemaining,
    features: this.features,
    tokenMultiplier: this.tokenMultiplier,
    tokenDailyLimit: this.tokenDailyLimit,
    isComplimentary: this.isComplimentary,
    hasPaymentMethod: !!this.stripePaymentMethodId,
    latestPayment: this.paymentHistory.length > 0 ? 
      this.paymentHistory[this.paymentHistory.length - 1] : null
  };
};

// Mark subscription as canceled
subscriptionSchema.methods.markAsCanceled = async function(cancelImmediately = false) {
  const now = new Date();
  
  this.hasCanceled = true;
  this.canceledAt = now;
  this.autoRenew = false;
  
  if (cancelImmediately) {
    this.status = 'canceled';
    this.endDate = now;
  } else {
    this.cancelAtPeriodEnd = true;
    // Status remains active until the end of the period
  }
  
  await this.save();
  return this;
};

// Add a payment record
subscriptionSchema.methods.addPayment = async function(paymentDetails) {
  this.paymentHistory.push({
    paymentId: paymentDetails.id,
    amount: paymentDetails.amount,
    currency: paymentDetails.currency,
    status: paymentDetails.status,
    date: new Date(),
    errorMessage: paymentDetails.errorMessage
  });
  
  await this.save();
  return this;
};

// Static method to create or update a subscription
subscriptionSchema.statics.createOrUpdate = async function(userId, subscriptionData) {
  // Find existing subscription
  let subscription = await this.findOne({ userId });
  
  if (subscription) {
    // Update existing subscription
    Object.assign(subscription, subscriptionData);
    subscription.updatedAt = new Date();
  } else {
    // Create new subscription
    subscription = new this({
      userId,
      ...subscriptionData
    });
  }
  
  await subscription.save();
  return subscription;
};

// Get active subscription tiers with details
subscriptionSchema.statics.getAvailableTiers = function() {
  return [
    {
      id: 'free',
      name: 'Free Tier',
      price: 0,
      currency: 'USD',
      billingPeriod: 'month',
      features: [
        'Basic stream access',
        'Limited chat features',
        'Earn tokens at standard rate',
        'Up to 500 tokens per day'
      ],
      tokenMultiplier: 1,
      tokenDailyLimit: 500,
    },
    {
      id: 'basic',
      name: 'Basic Supporter',
      price: 5,
      currency: 'USD',
      billingPeriod: 'month',
      features: [
        'Ad-free viewing',
        'Enhanced chat features (badges)',
        '1.5x token earning rate',
        'Up to 750 tokens per day',
        'Access to basic boosts'
      ],
      tokenMultiplier: 1.5,
      tokenDailyLimit: 750,
    },
    {
      id: 'premium',
      name: 'Premium Supporter',
      price: 15,
      currency: 'USD',
      billingPeriod: 'month',
      features: [
        'All Basic features',
        'Exclusive chat emotes',
        '2x token earning rate',
        'Up to 1000 tokens per day',
        'Access to premium boosts',
        'Priority support'
      ],
      tokenMultiplier: 2,
      tokenDailyLimit: 1000,
    },
    {
      id: 'annual',
      name: 'Annual Premium',
      price: 150,
      currency: 'USD',
      billingPeriod: 'year',
      features: [
        'All Premium features',
        '2.5x token earning rate',
        'Up to 1200 tokens per day',
        'Exclusive annual subscriber badge',
        'Two months free compared to monthly'
      ],
      tokenMultiplier: 2.5,
      tokenDailyLimit: 1200,
    }
  ];
};

// Find expired subscriptions that need processing
subscriptionSchema.statics.findExpiredSubscriptions = async function() {
  const now = new Date();
  
  return await this.find({
    status: { $in: ['active', 'trialing'] },
    endDate: { $lt: now },
    autoRenew: false
  }).populate('userId');
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
