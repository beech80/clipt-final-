const { validationResult } = require('express-validator');
const User = require('../models/user.model');
const Subscription = require('../models/subscription.model');
const Transaction = require('../models/transaction.model');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Configure Stripe with API key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key');

/**
 * Subscription Controller
 * Handles user subscription tiers and payment processing
 */

// Get all available subscription tiers
exports.getSubscriptionTiers = async (req, res, next) => {
  try {
    // Get subscription tiers
    // Customize with the specific tier details from user memory
    const tiers = [
      {
        id: 'free',
        name: 'Free',
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
        name: 'Pro',
        price: 4.99,
        currency: 'USD',
        billingPeriod: 'month',
        features: [
          'Ad-free viewing',
          'Enhanced chat features',
          '1.5x token earning rate',
          'Up to 750 tokens per day',
          'Access to basic boosts',
          'Discounted boost prices'
        ],
        tokenMultiplier: 1.5,
        tokenDailyLimit: 750,
      },
      {
        id: 'premium',
        name: 'Maxed',
        price: 14.99,
        currency: 'USD',
        billingPeriod: 'month',
        features: [
          'All Pro features',
          'Exclusive chat emotes',
          '2x token earning rate',
          'Up to 1000 tokens per day',
          'Access to premium boosts',
          'Priority support',
          'Monthly token bonus',
          'Exclusive streaming tools'
        ],
        tokenMultiplier: 2,
        tokenDailyLimit: 1000,
      },
      {
        id: 'annual',
        name: 'Annual Maxed',
        price: 149.99, // Save ~$30 over monthly
        currency: 'USD',
        billingPeriod: 'year',
        features: [
          'All Maxed features',
          '2.5x token earning rate',
          'Up to 1200 tokens per day',
          'Exclusive annual subscriber badge',
          'Large signup bonus tokens',
          'Two months free compared to monthly'
        ],
        tokenMultiplier: 2.5,
        tokenDailyLimit: 1200,
      }
    ];
    
    res.status(200).json({
      status: 'success',
      data: tiers
    });
  } catch (error) {
    next(error);
  }
};

// Get user subscription
exports.getUserSubscription = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Check if the requesting user has permission
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to view this user\'s subscription'));
    }
    
    // Get user subscription
    let subscription = await Subscription.findOne({ userId });
    
    // If no subscription record exists, create a default 'free' subscription
    if (!subscription) {
      subscription = await Subscription.createOrUpdate(userId, {
        tierId: 'free',
        status: 'active',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: [
          'Basic stream access',
          'Limited chat features',
          'Earn tokens at standard rate'
        ],
        tokenMultiplier: 1,
        tokenDailyLimit: 500
      });
    }
    
    // Get the user to provide additional context
    const user = await User.findById(userId);
    
    res.status(200).json({
      status: 'success',
      data: {
        ...subscription.getDetails(),
        username: user ? user.username : undefined,
        email: user ? user.email : undefined,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create Stripe checkout session for subscription
exports.createCheckoutSession = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(AppError.validation('Validation failed', errors.array()));
    }
    
    const { tierId, successUrl, cancelUrl } = req.body;
    const userId = req.user.id;
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return next(AppError.notFound('User not found'));
    }
    
    // Validate tier
    const validTiers = ['basic', 'premium', 'annual'];
    if (!validTiers.includes(tierId)) {
      return next(AppError.badRequest('Invalid subscription tier'));
    }
    
    // Get tier details
    let price, interval, tierName;
    switch (tierId) {
      case 'basic':
        price = 499; // $4.99 in cents
        interval = 'month';
        tierName = 'Pro';
        break;
      case 'premium':
        price = 1499; // $14.99 in cents
        interval = 'month';
        tierName = 'Maxed';
        break;
      case 'annual':
        price = 14999; // $149.99 in cents
        interval = 'year';
        tierName = 'Annual Maxed';
        break;
    }
    
    // Create or get Stripe customer
    let customer;
    if (user.stripeCustomerId) {
      customer = user.stripeCustomerId;
    } else {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user._id.toString()
        }
      });
      customer = newCustomer.id;
      
      // Save Stripe customer ID to user
      user.stripeCustomerId = customer;
      await user.save();
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Clipt ${tierName} Subscription`,
              description: `${tierName} tier subscription for Clipt platform`,
            },
            unit_amount: price,
            recurring: {
              interval
            }
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: {
        userId: user._id.toString(),
        tierId
      }
    });
    
    logger.info(`Checkout session created for user ${userId} for tier ${tierId}`);
    
    res.status(200).json({
      status: 'success',
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    next(error);
  }
};

// Handle successful subscription upgrade
exports.handleSubscriptionSuccess = async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return next(AppError.badRequest('Session ID is required'));
    }
    
    // Get checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Verify session was successful
    if (session.payment_status !== 'paid') {
      return next(AppError.badRequest('Payment not completed'));
    }
    
    const { userId, tierId } = session.metadata;
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return next(AppError.notFound('User not found'));
    }
    
    // Update user tier
    user.tier = tierId;
    
    // Set token multiplier and daily limit based on tier
    switch (tierId) {
      case 'basic':
        user.tokenMultiplier = 1.5;
        user.dailyTokensLimit = 750;
        break;
      case 'premium':
        user.tokenMultiplier = 2;
        user.dailyTokensLimit = 1000;
        break;
      case 'annual':
        user.tokenMultiplier = 2.5;
        user.dailyTokensLimit = 1200;
        break;
    }
    
    await user.save();
    
    // Create or update subscription record
    const subscription = await Subscription.createOrUpdate(userId, {
      tierId,
      status: 'active',
      price: session.amount_total / 100, // Convert cents to dollars
      currency: session.currency.toUpperCase(),
      interval: tierId === 'annual' ? 'year' : 'month',
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      renewalDate: new Date(Date.now() + (tierId === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000), // Approximate
      features: getFeaturesByTier(tierId),
      tokenMultiplier: user.tokenMultiplier,
      tokenDailyLimit: user.dailyTokensLimit
    });
    
    // Add signup bonus tokens
    let bonusTokens = 0;
    if (tierId === 'basic') {
      bonusTokens = 500;
    } else if (tierId === 'premium') {
      bonusTokens = 1000;
    } else if (tierId === 'annual') {
      bonusTokens = 2500;
    }
    
    if (bonusTokens > 0) {
      await user.updateTokenBalance(bonusTokens);
      
      // Record transaction
      await Transaction.recordTransaction({
        userId: user._id,
        type: 'earning',
        activity: 'subscription_bonus',
        amount: bonusTokens,
        balanceAfter: user.tokenBalance,
        description: `Received ${bonusTokens} tokens signup bonus for ${getReadableTierName(tierId)} subscription`,
        relatedSubscriptionId: subscription._id
      });
    }
    
    logger.info(`User ${userId} successfully subscribed to ${tierId} tier`);
    
    res.status(200).json({
      status: 'success',
      data: {
        subscription: subscription.getDetails(),
        bonusTokens,
        newTokenBalance: user.tokenBalance
      }
    });
  } catch (error) {
    next(error);
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Check if the requesting user has permission
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to cancel this subscription'));
    }
    
    // Get subscription
    const subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      return next(AppError.notFound('Subscription not found'));
    }
    
    // Check if already canceled or free tier
    if (subscription.hasCanceled) {
      return next(AppError.badRequest('Subscription is already canceled'));
    }
    
    if (subscription.tierId === 'free') {
      return next(AppError.badRequest('Cannot cancel free tier'));
    }
    
    // If there's a Stripe subscription, cancel it there
    let stripeSubscription;
    if (subscription.stripeSubscriptionId) {
      try {
        stripeSubscription = await stripe.subscriptions.update(
          subscription.stripeSubscriptionId,
          { cancel_at_period_end: true }
        );
      } catch (err) {
        logger.error(`Failed to cancel Stripe subscription: ${err.message}`);
        // Continue with local cancellation even if Stripe fails
      }
    }
    
    // Mark subscription as canceled at end of current period
    await subscription.markAsCanceled(false);
    
    // Get user to update their tier status at end of period
    const user = await User.findById(userId);
    if (user) {
      // Schedule tier downgrade (in a real system, this would be handled by a webhook/cron)
      logger.info(`User ${userId} subscription scheduled to downgrade to free at end of period`);
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Subscription will be canceled at the end of the current billing period',
      data: {
        subscription: subscription.getDetails(),
        effectiveEndDate: subscription.endDate || subscription.renewalDate
      }
    });
  } catch (error) {
    next(error);
  }
};

// Webhook handler for Stripe events
exports.handleStripeWebhook = async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy_secret';
    
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
        
      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};

// Admin: Update user subscription
exports.adminUpdateSubscription = async (req, res, next) => {
  try {
    // Only admins can update subscriptions
    if (req.user.role !== 'admin') {
      return next(AppError.forbidden('You do not have permission to update subscriptions'));
    }
    
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(AppError.validation('Validation failed', errors.array()));
    }
    
    const { userId, tierId, isComplimentary, adminNotes } = req.body;
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return next(AppError.notFound('User not found'));
    }
    
    // Validate tier
    const validTiers = ['free', 'basic', 'premium', 'annual'];
    if (!validTiers.includes(tierId)) {
      return next(AppError.badRequest('Invalid subscription tier'));
    }
    
    // Update user tier
    user.tier = tierId;
    
    // Set token multiplier and daily limit based on tier
    switch (tierId) {
      case 'free':
        user.tokenMultiplier = 1;
        user.dailyTokensLimit = 500;
        break;
      case 'basic':
        user.tokenMultiplier = 1.5;
        user.dailyTokensLimit = 750;
        break;
      case 'premium':
        user.tokenMultiplier = 2;
        user.dailyTokensLimit = 1000;
        break;
      case 'annual':
        user.tokenMultiplier = 2.5;
        user.dailyTokensLimit = 1200;
        break;
    }
    
    await user.save();
    
    // Create or update subscription
    const subscription = await Subscription.createOrUpdate(userId, {
      tierId,
      status: 'active',
      price: getTierPrice(tierId),
      currency: 'USD',
      interval: tierId === 'annual' ? 'year' : 'month',
      isComplimentary: isComplimentary === true,
      adminNotes,
      features: getFeaturesByTier(tierId),
      tokenMultiplier: user.tokenMultiplier,
      tokenDailyLimit: user.dailyTokensLimit,
      renewalDate: isComplimentary ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : undefined // 1 year for complimentary
    });
    
    logger.info(`Admin ${req.user.id} updated subscription for user ${userId} to ${tierId} tier`);
    
    res.status(200).json({
      status: 'success',
      data: {
        subscription: subscription.getDetails(),
        user: {
          id: user._id,
          username: user.username,
          tier: user.tier,
          tokenMultiplier: user.tokenMultiplier,
          dailyTokensLimit: user.dailyTokensLimit
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// --- Helper Functions ---

// Handle Stripe checkout session completed event
async function handleCheckoutSessionCompleted(session) {
  try {
    const { userId, tierId } = session.metadata;
    
    // Check if user and subscription exist
    const user = await User.findById(userId);
    if (!user) {
      logger.error(`User not found for checkout session: ${session.id}`);
      return;
    }
    
    // Update user tier and subscription (similar to handleSubscriptionSuccess)
    // This is already handled by the success URL handler, but webhooks provide a backup
    
    logger.info(`Checkout session completed for user ${userId} for tier ${tierId}`);
  } catch (error) {
    logger.error(`Error handling checkout session completed: ${error.message}`);
  }
}

// Handle Stripe subscription updated event
async function handleSubscriptionUpdated(subscription) {
  try {
    // Find user by Stripe customer ID
    const user = await User.findOne({ stripeCustomerId: subscription.customer });
    if (!user) {
      logger.error(`User not found for Stripe subscription update: ${subscription.id}`);
      return;
    }
    
    // Update local subscription status
    const localSubscription = await Subscription.findOne({
      userId: user._id,
      stripeSubscriptionId: subscription.id
    });
    
    if (!localSubscription) {
      logger.error(`Local subscription not found for Stripe subscription: ${subscription.id}`);
      return;
    }
    
    // Update status and other fields
    localSubscription.status = subscription.status;
    localSubscription.renewalDate = new Date(subscription.current_period_end * 1000);
    localSubscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;
    localSubscription.hasCanceled = subscription.cancel_at_period_end;
    
    if (subscription.cancel_at) {
      localSubscription.endDate = new Date(subscription.cancel_at * 1000);
    }
    
    await localSubscription.save();
    
    logger.info(`Subscription updated for user ${user._id}: ${subscription.status}`);
  } catch (error) {
    logger.error(`Error handling subscription updated: ${error.message}`);
  }
}

// Handle Stripe subscription deleted event
async function handleSubscriptionDeleted(subscription) {
  try {
    // Find user by Stripe customer ID
    const user = await User.findOne({ stripeCustomerId: subscription.customer });
    if (!user) {
      logger.error(`User not found for Stripe subscription deletion: ${subscription.id}`);
      return;
    }
    
    // Update local subscription
    const localSubscription = await Subscription.findOne({
      userId: user._id,
      stripeSubscriptionId: subscription.id
    });
    
    if (!localSubscription) {
      logger.error(`Local subscription not found for Stripe subscription: ${subscription.id}`);
      return;
    }
    
    // Mark as canceled
    localSubscription.status = 'canceled';
    localSubscription.hasCanceled = true;
    localSubscription.endDate = new Date();
    await localSubscription.save();
    
    // Downgrade user to free tier
    user.tier = 'free';
    user.tokenMultiplier = 1;
    user.dailyTokensLimit = 500;
    await user.save();
    
    // Create new free subscription
    await Subscription.createOrUpdate(user._id, {
      tierId: 'free',
      status: 'active',
      price: 0,
      currency: 'USD',
      interval: 'month',
      features: getFeaturesByTier('free'),
      tokenMultiplier: 1,
      tokenDailyLimit: 500
    });
    
    logger.info(`User ${user._id} downgraded to free tier after subscription cancellation`);
  } catch (error) {
    logger.error(`Error handling subscription deleted: ${error.message}`);
  }
}

// Handle Stripe invoice payment succeeded event
async function handleInvoicePaymentSucceeded(invoice) {
  try {
    // Find user by Stripe customer ID
    const user = await User.findOne({ stripeCustomerId: invoice.customer });
    if (!user) {
      logger.error(`User not found for invoice payment: ${invoice.id}`);
      return;
    }
    
    // Find subscription
    const subscription = await Subscription.findOne({
      userId: user._id,
      stripeSubscriptionId: invoice.subscription
    });
    
    if (!subscription) {
      logger.error(`Subscription not found for invoice: ${invoice.id}`);
      return;
    }
    
    // Record payment
    await subscription.addPayment({
      id: invoice.id,
      amount: invoice.amount_paid / 100, // Convert from cents
      currency: invoice.currency.toUpperCase(),
      status: 'succeeded',
      date: new Date(invoice.created * 1000)
    });
    
    // Add monthly token bonus if applicable
    if (subscription.tierId === 'premium' || subscription.tierId === 'annual') {
      const bonusTokens = subscription.tierId === 'premium' ? 200 : 500;
      
      await user.updateTokenBalance(bonusTokens);
      
      // Record transaction
      await Transaction.recordTransaction({
        userId: user._id,
        type: 'earning',
        activity: 'subscription_bonus',
        amount: bonusTokens,
        balanceAfter: user.tokenBalance,
        description: `Received ${bonusTokens} tokens monthly bonus for ${getReadableTierName(subscription.tierId)} subscription`,
        relatedSubscriptionId: subscription._id
      });
      
      logger.info(`User ${user._id} received ${bonusTokens} tokens monthly bonus`);
    }
    
    logger.info(`Payment succeeded for user ${user._id}: ${invoice.amount_paid / 100} ${invoice.currency}`);
  } catch (error) {
    logger.error(`Error handling invoice payment succeeded: ${error.message}`);
  }
}

// Handle Stripe invoice payment failed event
async function handleInvoicePaymentFailed(invoice) {
  try {
    // Find user by Stripe customer ID
    const user = await User.findOne({ stripeCustomerId: invoice.customer });
    if (!user) {
      logger.error(`User not found for failed invoice payment: ${invoice.id}`);
      return;
    }
    
    // Find subscription
    const subscription = await Subscription.findOne({
      userId: user._id,
      stripeSubscriptionId: invoice.subscription
    });
    
    if (!subscription) {
      logger.error(`Subscription not found for failed invoice: ${invoice.id}`);
      return;
    }
    
    // Update subscription status
    subscription.status = 'past_due';
    await subscription.save();
    
    // Record failed payment
    await subscription.addPayment({
      id: invoice.id,
      amount: invoice.amount_due / 100, // Convert from cents
      currency: invoice.currency.toUpperCase(),
      status: 'failed',
      date: new Date(invoice.created * 1000),
      errorMessage: invoice.last_payment_error?.message || 'Payment failed'
    });
    
    logger.info(`Payment failed for user ${user._id}: ${invoice.amount_due / 100} ${invoice.currency}`);
    
    // TODO: Send payment failure notification to user
  } catch (error) {
    logger.error(`Error handling invoice payment failed: ${error.message}`);
  }
}

// Get features by tier ID
function getFeaturesByTier(tierId) {
  switch (tierId) {
    case 'free':
      return [
        'Basic stream access',
        'Limited chat features',
        'Earn tokens at standard rate',
        'Up to 500 tokens per day'
      ];
      
    case 'basic':
      return [
        'Ad-free viewing',
        'Enhanced chat features',
        '1.5x token earning rate',
        'Up to 750 tokens per day',
        'Access to basic boosts',
        'Discounted boost prices'
      ];
      
    case 'premium':
      return [
        'All Pro features',
        'Exclusive chat emotes',
        '2x token earning rate',
        'Up to 1000 tokens per day',
        'Access to premium boosts',
        'Priority support',
        'Monthly token bonus',
        'Exclusive streaming tools'
      ];
      
    case 'annual':
      return [
        'All Maxed features',
        '2.5x token earning rate',
        'Up to 1200 tokens per day',
        'Exclusive annual subscriber badge',
        'Large signup bonus tokens',
        'Two months free compared to monthly'
      ];
      
    default:
      return [];
  }
}

// Get price by tier ID
function getTierPrice(tierId) {
  switch (tierId) {
    case 'free': return 0;
    case 'basic': return 4.99;
    case 'premium': return 14.99;
    case 'annual': return 149.99;
    default: return 0;
  }
}

// Get readable tier name
function getReadableTierName(tierId) {
  switch (tierId) {
    case 'free': return 'Free';
    case 'basic': return 'Pro';
    case 'premium': return 'Maxed';
    case 'annual': return 'Annual Maxed';
    default: return tierId;
  }
}
