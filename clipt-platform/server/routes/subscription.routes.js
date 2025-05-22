const express = require('express');
const { body } = require('express-validator');
const subscriptionController = require('../controllers/subscription.controller');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/subscriptions/tiers
 * @desc    Get all available subscription tiers
 * @access  Public
 */
router.get('/tiers', subscriptionController.getSubscriptionTiers);

/**
 * @route   GET /api/subscriptions/user/:userId
 * @desc    Get user subscription
 * @access  Private
 */
router.get('/user/:userId', protect, subscriptionController.getUserSubscription);

/**
 * @route   GET /api/subscriptions/me
 * @desc    Get current user subscription
 * @access  Private
 */
router.get('/me', protect, (req, res, next) => {
  req.params.userId = req.user.id;
  subscriptionController.getUserSubscription(req, res, next);
});

/**
 * @route   POST /api/subscriptions/checkout
 * @desc    Create Stripe checkout session for subscription
 * @access  Private
 */
router.post(
  '/checkout',
  protect,
  [
    body('tierId')
      .isString()
      .notEmpty()
      .withMessage('Subscription tier ID is required'),
    body('successUrl')
      .optional()
      .isURL()
      .withMessage('Success URL must be a valid URL'),
    body('cancelUrl')
      .optional()
      .isURL()
      .withMessage('Cancel URL must be a valid URL')
  ],
  subscriptionController.createCheckoutSession
);

/**
 * @route   GET /api/subscriptions/success
 * @desc    Handle successful subscription checkout
 * @access  Private
 */
router.get('/success', protect, subscriptionController.handleSubscriptionSuccess);

/**
 * @route   DELETE /api/subscriptions/cancel/:userId
 * @desc    Cancel user subscription
 * @access  Private
 */
router.delete('/cancel/:userId', protect, subscriptionController.cancelSubscription);

/**
 * @route   DELETE /api/subscriptions/cancel
 * @desc    Cancel current user subscription
 * @access  Private
 */
router.delete('/cancel', protect, (req, res, next) => {
  req.params.userId = req.user.id;
  subscriptionController.cancelSubscription(req, res, next);
});

/**
 * @route   POST /api/subscriptions/webhook
 * @desc    Handle Stripe webhook events
 * @access  Public (but verified by Stripe signature)
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  subscriptionController.handleStripeWebhook
);

/**
 * @route   POST /api/subscriptions/admin/update
 * @desc    Admin: Update user subscription
 * @access  Private/Admin
 */
router.post(
  '/admin/update',
  protect,
  restrictTo('admin'),
  [
    body('userId')
      .isMongoId()
      .withMessage('Valid user ID is required'),
    body('tierId')
      .isString()
      .notEmpty()
      .withMessage('Subscription tier ID is required'),
    body('isComplimentary')
      .optional()
      .isBoolean()
      .withMessage('isComplimentary must be a boolean'),
    body('adminNotes')
      .optional()
      .isString()
      .withMessage('Admin notes must be a string')
  ],
  subscriptionController.adminUpdateSubscription
);

module.exports = router;
