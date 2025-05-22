const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * User Schema - Stores user profile, auth details and token economy metrics
 */
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true,
    unique: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't return password in queries by default
  },
  profilePicture: {
    type: String,
    default: function() {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.username)}&background=random`;
    }
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  isVerified: {
    type: Boolean, 
    default: false
  },
  // Token Economy Specific Fields
  tokenBalance: {
    type: Number,
    default: 0,
    min: [0, 'Token balance cannot be negative']
  },
  tier: {
    type: String,
    enum: ['free', 'basic', 'premium', 'annual'],
    default: 'free'
  },
  tokenMultiplier: {
    type: Number,
    default: 1,
    min: [0.1, 'Token multiplier cannot be less than 0.1']
  },
  dailyTokensEarned: {
    type: Number,
    default: 0
  },
  dailyTokensLimit: {
    type: Number,
    default: 500,
    min: [0, 'Daily tokens limit cannot be negative']
  },
  totalTokensEarned: {
    type: Number,
    default: 0
  },
  totalTokensSpent: {
    type: Number,
    default: 0
  },
  activeDaysStreak: {
    type: Number,
    default: 0
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  lastDailyReset: {
    type: Date,
    default: Date.now
  },
  // Auth-related timestamps
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  refreshToken: String,
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

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ tokenBalance: -1 });

// Pre-save middleware to hash passwords
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified
  if (!this.isModified('password')) return next();
  
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(12);
    // Hash the password with the salt
    this.password = await bcrypt.hash(this.password, salt);
    
    // Update passwordChangedAt timestamp if not new user
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; // Small buffer to ensure token creation works
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check if password is correct
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET || 'clipt_jwt_secret_key_change_this',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};

// Method to generate refresh token
userSchema.methods.generateRefreshToken = function() {
  const refreshToken = jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET || 'clipt_refresh_secret_key_change_this',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  
  this.refreshToken = refreshToken;
  return refreshToken;
};

// Method to check if password was changed after token issuance
userSchema.methods.passwordChangedAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Method to update token balance
userSchema.methods.updateTokenBalance = async function(amount) {
  this.tokenBalance = Math.max(0, this.tokenBalance + amount);
  
  if (amount > 0) {
    this.totalTokensEarned += amount;
    
    // Update daily earnings tracking
    const now = new Date();
    const lastResetDate = new Date(this.lastDailyReset);
    
    // Check if we need to reset daily counters (different day)
    if (now.toDateString() !== lastResetDate.toDateString()) {
      this.dailyTokensEarned = amount;
      this.lastDailyReset = now;
      
      // Update streak
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastResetDate.toDateString() === yesterday.toDateString()) {
        // If they were active yesterday, increase streak
        this.activeDaysStreak += 1;
      } else {
        // Otherwise reset streak
        this.activeDaysStreak = 1;
      }
    } else {
      // Same day, just add to daily total
      this.dailyTokensEarned += amount;
    }
  } else if (amount < 0) {
    // Track spending (amount is negative, so we use Math.abs)
    this.totalTokensSpent += Math.abs(amount);
  }
  
  this.lastActive = new Date();
  await this.save();
  
  return {
    newBalance: this.tokenBalance,
    dailyEarned: this.dailyTokensEarned,
    dailyLimit: this.dailyTokensLimit,
    isAtDailyLimit: this.dailyTokensEarned >= this.dailyTokensLimit
  };
};

// Virtual for subscription status
userSchema.virtual('subscriptionActive').get(function() {
  return this.tier !== 'free';
});

// Serialize user data for safe client-side use
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    profilePicture: this.profilePicture,
    role: this.role,
    isVerified: this.isVerified,
    tokenBalance: this.tokenBalance,
    tier: this.tier,
    dailyTokensEarned: this.dailyTokensEarned,
    dailyTokensLimit: this.dailyTokensLimit,
    totalTokensEarned: this.totalTokensEarned,
    totalTokensSpent: this.totalTokensSpent,
    activeDaysStreak: this.activeDaysStreak,
    lastActive: this.lastActive,
    createdAt: this.createdAt
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
