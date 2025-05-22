const mongoose = require('mongoose');

/**
 * Transaction Schema
 * Stores all token transactions (earnings and spending)
 * Provides a complete audit trail for the token economy
 */
const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['earning', 'spending', 'adjustment', 'refund'],
    required: true,
    index: true
  },
  activity: {
    type: String,
    enum: [
      // Earning activities
      'stream_watch',
      'chat_message',
      'daily_login',
      'referral',
      'promotion',
      'gift',
      'streak_bonus',
      'task_completion',
      'engagement',
      'subscription_bonus',
      
      // Spending activities
      'boost_purchase',
      'chat_badge',
      'emote_pack',
      'custom_color',
      'stream_highlight',
      'priority_question',
      'feature_unlock',
      'gift_to_user',
      
      // Special
      'admin_adjustment',
      'system_adjustment',
      'refund'
    ],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    validate: {
      validator: function(value) {
        // For 'earning' type, amount should be positive
        // For 'spending' type, amount should be negative
        if (this.type === 'earning' && value <= 0) return false;
        if (this.type === 'spending' && value >= 0) return false;
        // Adjustments can be either positive or negative
        return true;
      },
      message: 'Amount must be positive for earnings and negative for spending'
    }
  },
  balanceAfter: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Related entities
  relatedBoostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boost',
    index: true
  },
  relatedSubscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    index: true
  },
  // Admin-related fields
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  // IP and device tracking for security
  ipAddress: String,
  userAgent: String,
  deviceId: String,
  // Standard timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: false // No updates allowed for transaction records
  }
});

// Define indexes for common queries
transactionSchema.index({ userId: 1, createdAt: -1 }); // User's transaction history
transactionSchema.index({ userId: 1, type: 1, createdAt: -1 }); // User's earnings or spending
transactionSchema.index({ userId: 1, activity: 1, createdAt: -1 }); // User's activity-specific transactions
transactionSchema.index({ createdAt: -1 }); // Global recent transactions

// Static method to record a new transaction
transactionSchema.statics.recordTransaction = async function({
  userId,
  type,
  activity,
  amount,
  balanceAfter,
  description = null,
  metadata = {},
  relatedBoostId = null,
  relatedSubscriptionId = null,
  adminId = null,
  ipAddress = null,
  userAgent = null,
  deviceId = null
}) {
  return await this.create({
    userId,
    type,
    activity,
    amount,
    balanceAfter,
    description,
    metadata,
    relatedBoostId,
    relatedSubscriptionId,
    adminId,
    ipAddress,
    userAgent,
    deviceId,
    createdAt: new Date()
  });
};

// Method to get user's transaction history with pagination
transactionSchema.statics.getUserTransactions = async function(userId, {
  page = 1,
  limit = 20,
  type = null,
  activity = null,
  startDate = null,
  endDate = null,
  sort = 'createdAt',
  order = 'desc'
}) {
  // Build query
  const query = { userId };
  if (type) query.type = type;
  if (activity) query.activity = activity;
  
  // Date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  // Sort order
  const sortDirection = order === 'asc' ? 1 : -1;
  const sortOptions = {};
  sortOptions[sort] = sortDirection;
  
  // Execute query with pagination
  const skip = (page - 1) * limit;
  
  // Get results and total count
  const [transactions, totalCount] = await Promise.all([
    this.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);
  
  // Calculate total pages
  const totalPages = Math.ceil(totalCount / limit);
  
  return {
    transactions,
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

// Method to get token analytics
transactionSchema.statics.getAnalytics = async function(userId, timeRange = '7d') {
  // Determine the date range
  const now = new Date();
  let startDate;
  
  switch (timeRange) {
    case '24h':
      startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      break;
    case '7d':
      startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      break;
    case '30d':
      startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      break;
    case 'all':
      startDate = new Date(0); // Beginning of time
      break;
    default:
      startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // Default to 7 days
  }
  
  // Base query for this user and date range
  const baseQuery = {
    userId: mongoose.Types.ObjectId(userId),
    createdAt: { $gte: startDate, $lte: now }
  };
  
  // Aggregate earnings by day
  const earningsPromise = this.aggregate([
    {
      $match: {
        ...baseQuery,
        type: 'earning'
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        amount: { $sum: '$amount' }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        amount: 1
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);
  
  // Aggregate spending by day
  const spendingPromise = this.aggregate([
    {
      $match: {
        ...baseQuery,
        type: 'spending'
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        amount: { $sum: { $abs: '$amount' } } // Convert negative to positive
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        amount: 1
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);
  
  // Aggregate top earning activities
  const topEarningPromise = this.aggregate([
    {
      $match: {
        ...baseQuery,
        type: 'earning'
      }
    },
    {
      $group: {
        _id: '$activity',
        total: { $sum: '$amount' }
      }
    },
    {
      $project: {
        _id: 0,
        activity: '$_id',
        total: 1
      }
    },
    {
      $sort: { total: -1 }
    },
    {
      $limit: 5
    }
  ]);
  
  // Aggregate top spending items
  const topSpendingPromise = this.aggregate([
    {
      $match: {
        ...baseQuery,
        type: 'spending'
      }
    },
    {
      $group: {
        _id: '$activity',
        total: { $sum: { $abs: '$amount' } } // Convert negative to positive
      }
    },
    {
      $project: {
        _id: 0,
        item: '$_id',
        total: 1
      }
    },
    {
      $sort: { total: -1 }
    },
    {
      $limit: 5
    }
  ]);
  
  // Calculate overall statistics
  const statsPromise = this.aggregate([
    {
      $match: { ...baseQuery }
    },
    {
      $group: {
        _id: '$type',
        total: { 
          $sum: { 
            $cond: [
              { $eq: ['$type', 'spending'] }, 
              { $abs: '$amount' },  // Convert negative to positive for spending
              '$amount'
            ]
          }
        },
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Execute all promises in parallel
  const [earnings, spending, topEarningActivities, topSpendingItems, stats] = await Promise.all([
    earningsPromise,
    spendingPromise,
    topEarningPromise,
    topSpendingPromise,
    statsPromise
  ]);
  
  // Process stats
  const processedStats = {
    totalEarned: 0,
    totalSpent: 0,
    earningCount: 0,
    spendingCount: 0,
    netChange: 0
  };
  
  stats.forEach(item => {
    if (item._id === 'earning') {
      processedStats.totalEarned = item.total;
      processedStats.earningCount = item.count;
    } else if (item._id === 'spending') {
      processedStats.totalSpent = item.total;
      processedStats.spendingCount = item.count;
    }
  });
  
  processedStats.netChange = processedStats.totalEarned - processedStats.totalSpent;
  
  // Return the complete analytics data
  return {
    timeRange,
    earnings,
    spending,
    topEarningActivities,
    topSpendingItems,
    stats: processedStats
  };
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
