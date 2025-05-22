import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';

// API base URL from environment variable
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Define default user state
const defaultUserState = {
  isAuthenticated: false,
  userId: null,
  username: null,
  email: null,
  tokenBalance: 0,
  tier: 'free',
  tokenMultiplier: 1,
  dailyTokensLimit: 500,
  profilePicture: null,
  lastLogin: null,
  subscription: null,
};

// Create AuthContext
export const AuthContext = createContext();

// Custom hook for using AuthContext
export const useAuth = () => useContext(AuthContext);

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(defaultUserState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Initialize auth state from localStorage on component mount
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedUser = localStorage.getItem('clipt_user');
        const storedToken = localStorage.getItem('clipt_token');
        
        if (storedUser && storedToken) {
          // Set auth headers for all future requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.error('Error initializing auth state:', err);
        // Clear potentially corrupted localStorage data
        localStorage.removeItem('clipt_user');
        localStorage.removeItem('clipt_token');
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();
  }, []);
  
  // Refresh user data from the server
  const refreshUserData = useCallback(async () => {
    if (!user.isAuthenticated || !user.userId) return;
    
    try {
      setLoading(true);
      // This would be a real API call in production
      // const response = await axios.get(`${API_BASE_URL}/users/${user.userId}`);
      // setUser(prevUser => ({ ...prevUser, ...response.data }));
      
      // Mock implementation for now
      console.log('Refreshing user data for:', user.userId);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // In a real implementation, update with fresh data from backend
      setUser(prevUser => ({
        ...prevUser,
        lastRefreshed: new Date().toISOString()
      }));
      
    } catch (err) {
      console.error('Error refreshing user data:', err);
      setError('Failed to refresh user data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user.isAuthenticated, user.userId]);
  
  // Login function
  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      
      // This would be a real API call in production
      // const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
      // const { user: userData, token } = response.data;
      
      // Mock implementation for now
      console.log('Login attempt with:', credentials);
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
      
      // Mock successful login
      const mockToken = 'mock_jwt_token_' + Math.random().toString(36).substring(2);
      const mockUserData = {
        isAuthenticated: true,
        userId: credentials.email === 'admin@example.com' ? 'admin123' : 'user' + Math.floor(Math.random() * 10000),
        username: credentials.email.split('@')[0],
        email: credentials.email,
        tokenBalance: 1000,
        tier: 'free',
        tokenMultiplier: 1,
        dailyTokensLimit: 500,
        profilePicture: `https://ui-avatars.com/api/?name=${encodeURIComponent(credentials.email.split('@')[0])}&background=random`,
        lastLogin: new Date().toISOString(),
        subscription: null,
      };
      
      // Set auth headers for all future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
      
      // Save to localStorage
      localStorage.setItem('clipt_user', JSON.stringify(mockUserData));
      localStorage.setItem('clipt_token', mockToken);
      
      // Update state
      setUser(mockUserData);
      
      return mockUserData;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Login failed. Please check your credentials and try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Logout function
  const logout = useCallback(() => {
    // Clear auth headers
    delete axios.defaults.headers.common['Authorization'];
    
    // Clear localStorage
    localStorage.removeItem('clipt_user');
    localStorage.removeItem('clipt_token');
    
    // Reset user state
    setUser(defaultUserState);
  }, []);
  
  // Register function
  const register = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      // This would be a real API call in production
      // const response = await axios.post(`${API_BASE_URL}/auth/register`, userData);
      
      // Mock implementation for now
      console.log('Register attempt with:', userData);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      
      // Mock successful registration
      return { success: true, message: 'Registration successful. Please log in.' };
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Update token balance
  const updateTokenBalance = useCallback((amount) => {
    setUser(prevUser => {
      const newBalance = prevUser.tokenBalance + amount;
      
      // Update localStorage with new balance
      if (prevUser.isAuthenticated) {
        const updatedUser = { ...prevUser, tokenBalance: newBalance };
        localStorage.setItem('clipt_user', JSON.stringify(updatedUser));
      }
      
      return { ...prevUser, tokenBalance: newBalance };
    });
  }, []);
  
  // Update user tier
  const updateUserTier = useCallback((newTier) => {
    setUser(prevUser => {
      const updatedUser = { ...prevUser, tier: newTier };
      
      // Update localStorage with new tier
      if (prevUser.isAuthenticated) {
        localStorage.setItem('clipt_user', JSON.stringify(updatedUser));
      }
      
      return updatedUser;
    });
  }, []);
  
  // Update user subscription details
  const updateUserSubscription = useCallback((subscription) => {
    if (!subscription) return;
    
    setUser(prevUser => {
      // Extract key details from subscription
      const { tierId, tokenMultiplier, tokenDailyLimit } = subscription;
      
      // Create updated user object
      const updatedUser = { 
        ...prevUser, 
        tier: tierId || prevUser.tier,
        tokenMultiplier: tokenMultiplier || prevUser.tokenMultiplier || 1,
        dailyTokensLimit: tokenDailyLimit || prevUser.dailyTokensLimit || 500,
        subscription: subscription
      };
      
      // Update localStorage
      if (prevUser.isAuthenticated) {
        localStorage.setItem('clipt_user', JSON.stringify(updatedUser));
      }
      
      return updatedUser;
    });
  }, []);
  
  // Context value
  const authContextValue = {
    user,
    loading,
    error,
    login,
    logout,
    register,
    refreshUserData,
    updateTokenBalance,
    updateUserTier,
    updateUserSubscription,
    isAuthenticated: user.isAuthenticated,
  };
  
  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
