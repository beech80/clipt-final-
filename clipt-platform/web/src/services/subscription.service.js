import api from './api';

/**
 * Subscription Service
 * Handles all subscription-related API calls and logic
 */
class SubscriptionService {
  /**
   * Get all available subscription tiers
   * @returns {Promise<Array>} Array of subscription tier objects
   */
  async getSubscriptionTiers() {
    try {
      const response = await api.get('/api/subscriptions/tiers');
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch subscription tiers:', error);
      throw error;
    }
  }

  /**
   * Get the current user's subscription details
   * @returns {Promise<Object>} User subscription object
   */
  async getCurrentSubscription() {
    try {
      const response = await api.get('/api/subscriptions/me');
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch current subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription details for a specific user (admin only)
   * @param {string} userId - User ID to fetch subscription for
   * @returns {Promise<Object>} User subscription object
   */
  async getUserSubscription(userId) {
    try {
      const response = await api.get(`/api/subscriptions/user/${userId}`);
      return response.data.data;
    } catch (error) {
      console.error(`Failed to fetch subscription for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create a checkout session for subscription purchase/upgrade
   * @param {string} tierId - ID of the tier to subscribe to
   * @param {string} successUrl - URL to redirect after successful payment
   * @param {string} cancelUrl - URL to redirect if payment is canceled
   * @returns {Promise<Object>} Checkout session data
   */
  async createCheckoutSession(tierId, successUrl, cancelUrl) {
    try {
      const response = await api.post('/api/subscriptions/checkout', {
        tierId,
        successUrl,
        cancelUrl
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      throw error;
    }
  }

  /**
   * Handle successful checkout redirect
   * @param {string} sessionId - Stripe checkout session ID
   * @returns {Promise<Object>} Updated subscription data
   */
  async handleSubscriptionSuccess(sessionId) {
    try {
      const response = await api.get(`/api/subscriptions/success?sessionId=${sessionId}`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to process successful subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel the current user's subscription
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelSubscription() {
    try {
      const response = await api.delete('/api/subscriptions/cancel');
      return response.data;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription for a specific user (admin only)
   * @param {string} userId - User ID to cancel subscription for
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelUserSubscription(userId) {
    try {
      const response = await api.delete(`/api/subscriptions/cancel/${userId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to cancel subscription for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Admin: Update a user's subscription
   * @param {Object} subscriptionData - Subscription update data
   * @param {string} subscriptionData.userId - User ID to update
   * @param {string} subscriptionData.tierId - New tier ID
   * @param {boolean} [subscriptionData.isComplimentary] - Whether this is a complimentary subscription
   * @param {string} [subscriptionData.adminNotes] - Admin notes about this update
   * @returns {Promise<Object>} Updated subscription data
   */
  async adminUpdateSubscription(subscriptionData) {
    try {
      const response = await api.post('/api/subscriptions/admin/update', subscriptionData);
      return response.data.data;
    } catch (error) {
      console.error('Failed to update subscription as admin:', error);
      throw error;
    }
  }

  /**
   * Get readable tier name from tier ID
   * @param {string} tierId - Tier ID
   * @returns {string} Human-readable tier name
   */
  getTierName(tierId) {
    const tierNames = {
      free: 'Free',
      basic: 'Pro',
      premium: 'Maxed',
      annual: 'Annual Maxed'
    };
    
    return tierNames[tierId] || tierId;
  }

  /**
   * Get tier color for UI styling
   * @param {string} tierId - Tier ID
   * @returns {string} CSS color value
   */
  getTierColor(tierId) {
    const tierColors = {
      free: '#6c757d', // Gray
      basic: '#007bff', // Blue
      premium: '#6f42c1', // Purple
      annual: '#ffc107' // Gold
    };
    
    return tierColors[tierId] || '#6c757d';
  }

  /**
   * Calculate savings compared to monthly for annual plan
   * @returns {Object} Savings data
   */
  calculateAnnualSavings() {
    const monthlyPrice = 14.99;
    const annualPrice = 149.99;
    const monthlyCost = monthlyPrice * 12;
    const savings = monthlyCost - annualPrice;
    const savingsPercent = (savings / monthlyCost) * 100;
    
    return {
      savings: savings.toFixed(2),
      savingsPercent: Math.round(savingsPercent),
      equivalentMonthly: (annualPrice / 12).toFixed(2)
    };
  }

  /**
   * Get token earning bonus multiplier for a tier
   * @param {string} tierId - Tier ID
   * @returns {number} Token multiplier value
   */
  getTokenMultiplier(tierId) {
    const multipliers = {
      free: 1,
      basic: 1.5,
      premium: 2,
      annual: 2.5
    };
    
    return multipliers[tierId] || 1;
  }

  /**
   * Get daily token limit for a tier
   * @param {string} tierId - Tier ID
   * @returns {number} Daily token limit
   */
  getDailyTokenLimit(tierId) {
    const limits = {
      free: 500,
      basic: 750,
      premium: 1000,
      annual: 1200
    };
    
    return limits[tierId] || 500;
  }
}

// Create singleton instance
const subscriptionService = new SubscriptionService();
export default subscriptionService;
