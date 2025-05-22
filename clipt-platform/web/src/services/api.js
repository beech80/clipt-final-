import axios from 'axios';

// Create API config
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_TIMEOUT = 15000; // 15 seconds

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('clipt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle token expiration (401)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Check if we have a refresh token
      const refreshToken = localStorage.getItem('clipt_refresh_token');
      if (refreshToken) {
        try {
          // Attempt to refresh the token
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          
          const { token } = response.data;
          localStorage.setItem('clipt_token', token);
          
          // Update the failed request with the new token
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          // If refresh fails, force logout
          localStorage.removeItem('clipt_token');
          localStorage.removeItem('clipt_refresh_token');
          localStorage.removeItem('clipt_user');
          
          // Redirect to login page (can be handled by React Router)
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }
    
    // Enhance error object with user-friendly message
    if (error.response) {
      // Server responded with a status code outside of 2xx range
      error.userMessage = error.response.data?.message || 
        getErrorMessageForStatus(error.response.status);
    } else if (error.request) {
      // Request was made but no response received
      error.userMessage = 'No response from server. Please check your internet connection.';
      console.error('No response received:', error.request);
    } else {
      // Something else caused the error
      error.userMessage = 'An unexpected error occurred. Please try again.';
      console.error('Error during request setup:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Helper to get user-friendly error messages
const getErrorMessageForStatus = (status) => {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your data and try again.';
    case 401:
      return 'You need to log in to access this resource.';
    case 403:
      return 'You do not have permission to access this resource.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'A conflict occurred. The resource may already exist.';
    case 422:
      return 'Validation failed. Please check your input.';
    case 429:
      return 'Too many requests. Please try again later.';
    case 500:
      return 'Server error. Our team has been notified.';
    case 503:
      return 'Service unavailable. Please try again later.';
    default:
      return `Error ${status}: Something went wrong. Please try again.`;
  }
};

// Exponential backoff retry logic for important API calls
const withRetry = async (apiCall, maxRetries = 3, initialDelay = 1000) => {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await apiCall();
    } catch (error) {
      // Don't retry for client errors (4xx) except for specific cases
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        // Retry only network timeouts (408) and rate limiting (429)
        if (error.response.status !== 408 && error.response.status !== 429) {
          throw error;
        }
      }
      
      retries += 1;
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = initialDelay * Math.pow(2, retries - 1) * (0.9 + Math.random() * 0.2);
      console.log(`API call failed, retrying in ${Math.round(delay)}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Mock implementation toggle (for development without backend)
let useMockResponses = true;

// Toggle mock mode
export const setMockMode = (useMock) => {
  useMockResponses = useMock;
};

// API service with both real and mock implementations
const apiService = {
  // -------------- AUTH API --------------
  auth: {
    login: async (credentials) => {
      if (useMockResponses) {
        // Mock login
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Validate credentials
        if (!credentials.email || !credentials.password) {
          throw {
            response: { status: 400, data: { message: 'Email and password are required' } },
            userMessage: 'Email and password are required'
          };
        }
        
        if (credentials.email === 'error@example.com') {
          throw {
            response: { status: 401, data: { message: 'Invalid email or password' } },
            userMessage: 'Invalid email or password'
          };
        }
        
        // Create mock response
        const mockToken = 'mock_jwt_token_' + Math.random().toString(36).substring(2);
        const mockRefreshToken = 'mock_refresh_' + Math.random().toString(36).substring(2);
        
        return {
          data: {
            user: {
              userId: credentials.email === 'admin@example.com' ? 'admin123' : 'user' + Math.floor(Math.random() * 10000),
              username: credentials.email.split('@')[0],
              email: credentials.email,
              tokenBalance: 1000,
              tier: 'free',
              profilePicture: `https://ui-avatars.com/api/?name=${encodeURIComponent(credentials.email.split('@')[0])}&background=random`,
              lastLogin: new Date().toISOString(),
            },
            token: mockToken,
            refreshToken: mockRefreshToken,
          }
        };
      }
      
      // Real implementation
      return await withRetry(() => apiClient.post('/auth/login', credentials));
    },
    
    register: async (userData) => {
      if (useMockResponses) {
        // Mock registration
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Basic validation
        if (!userData.email || !userData.password || !userData.username) {
          throw {
            response: { status: 400, data: { message: 'All fields are required' } },
            userMessage: 'All fields are required'
          };
        }
        
        if (userData.email === 'existing@example.com') {
          throw {
            response: { status: 409, data: { message: 'User already exists with this email' } },
            userMessage: 'User already exists with this email'
          };
        }
        
        return {
          data: {
            success: true,
            message: 'Registration successful. Please log in.'
          }
        };
      }
      
      // Real implementation
      return await withRetry(() => apiClient.post('/auth/register', userData));
    },
    
    refreshToken: async (refreshToken) => {
      if (useMockResponses) {
        // Mock token refresh
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!refreshToken) {
          throw {
            response: { status: 400, data: { message: 'Refresh token is required' } },
            userMessage: 'Refresh token is required'
          };
        }
        
        // Just generate a new token
        const mockToken = 'mock_jwt_token_' + Math.random().toString(36).substring(2);
        
        return {
          data: {
            token: mockToken,
          }
        };
      }
      
      // Real implementation
      return await apiClient.post('/auth/refresh', { refreshToken });
    },
    
    logout: async () => {
      if (useMockResponses) {
        // Mock logout (just a delay)
        await new Promise(resolve => setTimeout(resolve, 300));
        return { data: { success: true } };
      }
      
      // Real implementation
      return await apiClient.post('/auth/logout');
    },
  },
  
  // -------------- USER API --------------
  user: {
    getProfile: async (userId) => {
      if (useMockResponses) {
        // Mock user profile
        await new Promise(resolve => setTimeout(resolve, 600));
        
        if (!userId) {
          throw {
            response: { status: 400, data: { message: 'User ID is required' } },
            userMessage: 'User ID is required'
          };
        }
        
        // Generate mock transaction history
        const transactionTypes = ['stream_watch', 'chat_message', 'boost_purchase', 'tier_upgrade', 'daily_login'];
        const transactions = Array.from({ length: 15 }, (_, i) => {
          const isExpense = Math.random() > 0.7;
          const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
          const amount = isExpense ? -Math.floor(Math.random() * 200) : Math.floor(Math.random() * 50) + 10;
          
          return {
            id: `tx_${Math.random().toString(36).substring(2)}`,
            timestamp: new Date(Date.now() - i * 86400000 * Math.random()).toISOString(),
            type,
            amount,
            description: isExpense ? 
              `${amount * -1} tokens spent on ${type.replace('_', ' ')}` : 
              `${amount} tokens earned from ${type.replace('_', ' ')}`,
          };
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return {
          data: {
            userId,
            username: userId === 'admin123' ? 'admin' : 'user' + userId.replace(/\D/g, ''),
            email: userId === 'admin123' ? 'admin@example.com' : `user${userId.replace(/\D/g, '')}@example.com`,
            tokenBalance: 1000 + Math.floor(Math.random() * 2000),
            dailyEarnings: Math.floor(Math.random() * 200),
            dailyLimit: 500,
            tier: Math.random() > 0.7 ? 'premium' : 'free',
            profilePicture: `https://ui-avatars.com/api/?name=${userId}&background=random`,
            transactions: transactions,
            activeDaysStreak: Math.floor(Math.random() * 30),
            totalEarned: 5000 + Math.floor(Math.random() * 10000),
            totalSpent: 2000 + Math.floor(Math.random() * 5000),
          }
        };
      }
      
      // Real implementation
      return await apiClient.get(`/users/${userId}`);
    },
    
    updateProfile: async (userId, userData) => {
      if (useMockResponses) {
        // Mock profile update
        await new Promise(resolve => setTimeout(resolve, 700));
        
        return {
          data: {
            ...userData,
            userId,
            lastUpdated: new Date().toISOString(),
          }
        };
      }
      
      // Real implementation
      return await apiClient.put(`/users/${userId}`, userData);
    },
  },
  
  // -------------- TOKEN API --------------
  tokens: {
    getAnalytics: async (userId, timeRange = '7d') => {
      if (useMockResponses) {
        // Mock analytics data
        await new Promise(resolve => setTimeout(resolve, 800));
        
        if (!userId) {
          throw {
            response: { status: 400, data: { message: 'User ID is required' } },
            userMessage: 'User ID is required'
          };
        }
        
        // Generate different data based on timeRange
        let days;
        switch (timeRange) {
          case '30d': days = 30; break;
          case 'all': days = 90; break;
          default: days = 7;
        }
        
        // Generate daily earnings/spending data
        const earnings = [];
        const spending = [];
        
        for (let i = 0; i < days; i++) {
          const date = new Date();
          date.setDate(date.getDate() - (days - i - 1));
          const dateStr = date.toISOString().split('T')[0];
          
          // More earnings than spending usually
          const earned = Math.floor(Math.random() * 150) + 20;
          earnings.push({ date: dateStr, amount: earned });
          
          // Only add spending on some days
          if (Math.random() > 0.6) {
            const spent = Math.floor(Math.random() * 100) + 10;
            spending.push({ date: dateStr, amount: spent });
          }
        }
        
        return {
          data: {
            earnings,
            spending,
            topEarningActivities: [
              { activity: 'Watching Streams', total: 300 + Math.floor(Math.random() * 500) },
              { activity: 'Chatting', total: 200 + Math.floor(Math.random() * 300) },
              { activity: 'Daily Login', total: 100 + Math.floor(Math.random() * 100) },
              { activity: 'Referrals', total: 50 + Math.floor(Math.random() * 150) },
            ],
            topSpendingItems: [
              { item: 'Chat Badge', total: 100 + Math.floor(Math.random() * 200) },
              { item: 'Stream Highlight', total: 50 + Math.floor(Math.random() * 100) },
              { item: 'Emote Pack', total: 20 + Math.floor(Math.random() * 80) },
              { item: 'Custom Color', total: 10 + Math.floor(Math.random() * 50) },
            ],
          }
        };
      }
      
      // Real implementation
      return await apiClient.get(`/tokens/analytics/${userId}`, {
        params: { range: timeRange }
      });
    },
    
    earnTokens: async (userId, activity, amount) => {
      if (useMockResponses) {
        // Mock token earning
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!userId || !activity || !amount) {
          throw {
            response: { status: 400, data: { message: 'User ID, activity, and amount are required' } },
            userMessage: 'User ID, activity, and amount are required'
          };
        }
        
        // Check if exceeded daily limit (sometimes)
        if (amount > 100 && Math.random() > 0.8) {
          throw {
            response: { status: 400, data: { message: 'Daily earning limit exceeded' } },
            userMessage: 'You have reached your daily earning limit'
          };
        }
        
        return {
          data: {
            userId,
            activity,
            amount,
            newBalance: 1000 + amount, // This is just a placeholder
            timestamp: new Date().toISOString(),
            transactionId: `tx_${Math.random().toString(36).substring(2)}`,
          }
        };
      }
      
      // Real implementation
      return await apiClient.post('/tokens/earn', {
        userId,
        activity,
        amount
      });
    },
    
    spendTokens: async (userId, item, amount) => {
      if (useMockResponses) {
        // Mock token spending
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!userId || !item || !amount) {
          throw {
            response: { status: 400, data: { message: 'User ID, item, and amount are required' } },
            userMessage: 'User ID, item, and amount are required'
          };
        }
        
        // Check if has enough tokens (sometimes fail)
        if (amount > 500 && Math.random() > 0.7) {
          throw {
            response: { status: 400, data: { message: 'Insufficient token balance' } },
            userMessage: 'You do not have enough tokens for this purchase'
          };
        }
        
        return {
          data: {
            userId,
            item,
            amount: -amount, // Negative for spending
            newBalance: 1000 - amount, // This is just a placeholder
            timestamp: new Date().toISOString(),
            transactionId: `tx_${Math.random().toString(36).substring(2)}`,
          }
        };
      }
      
      // Real implementation
      return await apiClient.post('/tokens/spend', {
        userId,
        item,
        amount
      });
    },
  },
  
  // -------------- BOOST API --------------
  boosts: {
    getAvailable: async (userId) => {
      if (useMockResponses) {
        // Mock available boosts
        await new Promise(resolve => setTimeout(resolve, 600));
        
        return {
          data: [
            {
              id: 'boost_chat_badge',
              name: 'Premium Chat Badge',
              description: 'Stand out in chat with a special badge next to your name',
              price: 200,
              duration: 7, // days
              category: 'appearance',
              tierRequired: 'free',
              image: 'https://placehold.co/200x200/purple/white?text=BADGE',
            },
            {
              id: 'boost_stream_highlight',
              name: 'Stream Highlight',
              description: 'Your messages are highlighted in the stream for increased visibility',
              price: 500,
              duration: 1, // days
              category: 'visibility',
              tierRequired: 'free',
              image: 'https://placehold.co/200x200/gold/white?text=HIGHLIGHT',
            },
            {
              id: 'boost_custom_color',
              name: 'Custom Name Color',
              description: 'Choose a custom color for your username in chat',
              price: 300,
              duration: 7, // days
              category: 'appearance',
              tierRequired: 'free',
              image: 'https://placehold.co/200x200/rainbow/white?text=COLOR',
            },
            {
              id: 'boost_emote_pack',
              name: 'Exclusive Emote Pack',
              description: 'Get access to 5 exclusive emotes to use in chat',
              price: 750,
              duration: 30, // days
              category: 'content',
              tierRequired: 'free',
              image: 'https://placehold.co/200x200/pink/white?text=EMOTES',
            },
            {
              id: 'boost_double_tokens',
              name: 'Double Token Earnings',
              description: 'Earn twice as many tokens from all activities for 24 hours',
              price: 1000,
              duration: 1, // days
              category: 'earnings',
              tierRequired: 'free',
              image: 'https://placehold.co/200x200/green/white?text=2X',
            },
            {
              id: 'boost_priority_questions',
              name: 'Priority Questions',
              description: 'Your questions get priority in Q&A segments',
              price: 500,
              duration: 1, // stream
              category: 'interaction',
              tierRequired: 'basic',
              image: 'https://placehold.co/200x200/blue/white?text=PRIORITY',
            },
            {
              id: 'boost_permanent_badge',
              name: 'Permanent Supporter Badge',
              description: 'A special badge that never expires showing your support',
              price: 5000,
              duration: -1, // permanent
              category: 'appearance',
              tierRequired: 'premium',
              image: 'https://placehold.co/200x200/crimson/white?text=VIP',
            },
          ]
        };
      }
      
      // Real implementation
      return await apiClient.get('/boosts', {
        params: { userId }
      });
    },
    
    purchaseBoost: async (userId, boostId) => {
      if (useMockResponses) {
        // Mock boost purchase
        await new Promise(resolve => setTimeout(resolve, 700));
        
        // Get the mock boost details
        const mockBoosts = (await this.boosts.getAvailable()).data;
        const boost = mockBoosts.find(b => b.id === boostId);
        
        if (!boost) {
          throw {
            response: { status: 404, data: { message: 'Boost not found' } },
            userMessage: 'Boost not found'
          };
        }
        
        // Check if user has enough tokens (randomly fail sometimes)
        if (boost.price > 1000 && Math.random() > 0.7) {
          throw {
            response: { status: 400, data: { message: 'Insufficient token balance' } },
            userMessage: 'You do not have enough tokens for this purchase'
          };
        }
        
        // Calculate expiry
        let expiresAt = null;
        if (boost.duration > 0) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + boost.duration);
        }
        
        return {
          data: {
            id: `purchase_${Math.random().toString(36).substring(2)}`,
            userId,
            boostId,
            boost: {
              name: boost.name,
              description: boost.description,
            },
            purchasedAt: new Date().toISOString(),
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
            price: boost.price,
            newTokenBalance: 1000 - boost.price, // This is just a placeholder
          }
        };
      }
      
      // Real implementation
      return await withRetry(() => apiClient.post('/boosts/purchase', {
        userId,
        boostId
      }));
    },
    
    getUserBoosts: async (userId) => {
      if (useMockResponses) {
        // Mock user boosts
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Generate some mock active boosts
        return {
          data: [
            {
              id: `purchase_${Math.random().toString(36).substring(2)}`,
              boostId: 'boost_custom_color',
              name: 'Custom Name Color',
              description: 'Choose a custom color for your username in chat',
              purchasedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
              expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
              isActive: true,
            },
            {
              id: `purchase_${Math.random().toString(36).substring(2)}`,
              boostId: 'boost_emote_pack',
              name: 'Exclusive Emote Pack',
              description: 'Get access to 5 exclusive emotes to use in chat',
              purchasedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
              expiresAt: new Date(Date.now() + 25 * 86400000).toISOString(),
              isActive: true,
            },
            {
              id: `purchase_${Math.random().toString(36).substring(2)}`,
              boostId: 'boost_stream_highlight',
              name: 'Stream Highlight',
              description: 'Your messages are highlighted in the stream for increased visibility',
              purchasedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
              expiresAt: new Date(Date.now() - 2 * 3600000).toISOString(), // Expired a few hours ago
              isActive: false,
            },
          ]
        };
      }
      
      // Real implementation
      return await apiClient.get(`/boosts/user/${userId}`);
    },
  },
  
  // -------------- SUBSCRIPTION API --------------
  subscriptions: {
    getTiers: async () => {
      if (useMockResponses) {
        // Mock subscription tiers
        await new Promise(resolve => setTimeout(resolve, 400));
        
        return {
          data: [
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
            },
          ]
        };
      }
      
      // Real implementation
      return await apiClient.get('/subscriptions/tiers');
    },
    
    getUserSubscription: async (userId) => {
      if (useMockResponses) {
        // Mock user subscription
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Randomly choose a tier for mock data
        const tiers = ['free', 'basic', 'premium'];
        const randomTier = tiers[Math.floor(Math.random() * tiers.length)];
        
        // Only have billing info for paid tiers
        const hasBillingInfo = randomTier !== 'free';
        
        return {
          data: {
            userId,
            tierId: randomTier,
            status: 'active',
            startDate: new Date(Date.now() - 30 * 86400000 * Math.random() * 6).toISOString(),
            renewalDate: new Date(Date.now() + 30 * 86400000).toISOString(),
            paymentMethod: hasBillingInfo ? {
              type: 'card',
              last4: '4242',
              expiryMonth: 12,
              expiryYear: 2025,
              brand: 'visa'
            } : null,
            hasCancelled: false,
          }
        };
      }
      
      // Real implementation
      return await apiClient.get(`/subscriptions/user/${userId}`);
    },
    
    createCheckoutSession: async (userId, tierId) => {
      if (useMockResponses) {
        // Mock checkout session creation
        await new Promise(resolve => setTimeout(resolve, 800));
        
        return {
          data: {
            sessionId: `mock_session_${Math.random().toString(36).substring(2)}`,
            checkoutUrl: 'https://example.com/mock-checkout',
          }
        };
      }
      
      // Real implementation
      return await withRetry(() => apiClient.post('/subscriptions/create-checkout-session', {
        userId,
        tierId,
        successUrl: window.location.origin + '/subscription/success',
        cancelUrl: window.location.origin + '/subscription/cancel',
      }));
    },
    
    cancelSubscription: async (userId) => {
      if (useMockResponses) {
        // Mock subscription cancellation
        await new Promise(resolve => setTimeout(resolve, 600));
        
        return {
          data: {
            userId,
            cancelled: true,
            effectiveEndDate: new Date(Date.now() + 30 * 86400000).toISOString(), // End of current billing period
          }
        };
      }
      
      // Real implementation
      return await apiClient.post(`/subscriptions/${userId}/cancel`);
    },
  },
};

export default apiService;
