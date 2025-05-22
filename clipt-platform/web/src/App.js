import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { io } from 'socket.io-client';
import { loadStripe } from '@stripe/stripe-js';
import TokenReward from './components/TokenReward';
import TokenWallet from './components/TokenWallet';
import BoostShop from './components/BoostShop';
import TokenAnalytics from './components/TokenAnalytics';
import SubscriptionManager from './components/SubscriptionManager';
import LoginForm from './components/LoginForm';
import ErrorBoundary from './components/ErrorBoundary';
import StreamChat from './components/StreamChat/StreamChat';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import apiService from './services/api';
import subscriptionService from './services/subscription.service';
import './styles/App.css';

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy');

// Root App Component
function AppRoot() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Main App Component
function App() {
  // Access auth context
  const { user, isAuthenticated, loading: authLoading, updateTokenBalance } = useAuth();
  const videoRef = useRef();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const socket = useRef(null);
  const [currentPage, setCurrentPage] = useState(isAuthenticated ? 'stream' : 'login');
  const [rewardInfo, setRewardInfo] = useState({ isVisible: false, amount: 0, activity: '' });
  const [error, setError] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [subscriptionTiers, setSubscriptionTiers] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  // Chat system state
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [streamChannelId, setStreamChannelId] = useState('demo-channel-id'); // Would come from route in production

  // Error handling helper
  const handleApiError = useCallback((error, fallbackMessage = 'Something went wrong. Please try again.') => {
    console.error('API Error:', error);
    // Show user-friendly message
    setError(error.userMessage || fallbackMessage);
    // Auto dismiss after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, []);

  const showTokenReward = useCallback(async (amount, activity) => {
    try {
      setRewardInfo({ isVisible: true, amount, activity });
      
      // Update token balance in AuthContext
      updateTokenBalance(amount);
      
      // Record token earning in API (if authenticated)
      if (isAuthenticated && user.userId) {
        await apiService.tokens.earnTokens(user.userId, activity, amount)
          .catch(err => console.warn('Failed to record token earning:', err));
      }
    } catch (err) {
      handleApiError(err, 'Failed to process token reward');
    }
  }, [isAuthenticated, user, updateTokenBalance, handleApiError]);

  const handleCloseReward = () => {
    setRewardInfo({ ...rewardInfo, isVisible: false });
  };

  // Navigation handlers
  const handleNavigateToProfile = useCallback(() => {
    handleCloseReward();
    setCurrentPage('profile');
  }, []);

  const handleNavigateToBoostShop = useCallback(() => {
    handleCloseReward();
    setCurrentPage('boostShop');
  }, []);

  const handleNavigateToAnalytics = useCallback(() => {
    setCurrentPage('analytics');
  }, []);

  const handleNavigateToTiers = useCallback(() => {
    setCurrentPage('tiers');
    // Fetch subscription data when navigating to tiers page
    fetchSubscriptionData();
  }, []);

  const handleNavigateToStream = useCallback(() => {
    setCurrentPage('stream');
  }, []);
  
  const handleNavigateToLogin = useCallback(() => {
    setCurrentPage('login');
  }, []);
  
  // Handle successful login
  const handleLoginSuccess = useCallback((userData) => {
    console.log('Login successful:', userData);
    setCurrentPage('stream');
    
    // Fetch subscription data after login
    fetchSubscriptionData();
  }, []);
  
  // Fetch subscription tiers and user's current subscription
  const fetchSubscriptionData = useCallback(async () => {
    if (!isAuthenticated || !user?.userId) return;
    
    setIsSubscriptionLoading(true);
    try {
      // Fetch subscription tiers
      const tiers = await subscriptionService.getSubscriptionTiers();
      setSubscriptionTiers(tiers);
      
      // Fetch user's current subscription
      const subscription = await subscriptionService.getCurrentSubscription();
      setCurrentSubscription(subscription);
      
      // Update user's token multiplier in auth context
      if (subscription && user) {
        // You might want to add this method to your AuthContext
        // updateUserSubscription(subscription);
      }
    } catch (err) {
      handleApiError(err, 'Failed to load subscription information');
    } finally {
      setIsSubscriptionLoading(false);
    }
  }, [isAuthenticated, user, handleApiError]);
  
  // Check URL parameters for subscription success or cancellation
  useEffect(() => {
    const checkSubscriptionRedirect = async () => {
      if (!isAuthenticated) return;
      
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const sessionId = urlParams.get('session_id');
      const canceled = urlParams.get('canceled');
      
      if (success === 'true' && sessionId) {
        try {
          setIsLoadingData(true);
          // Process the successful subscription
          const result = await subscriptionService.handleSubscriptionSuccess(sessionId);
          setCurrentSubscription(result.subscription);
          
          // Show token reward for bonus tokens
          if (result.bonusTokens > 0) {
            showTokenReward(result.bonusTokens, 'subscription_bonus');
          }
          
          // Show success message
          setError({
            type: 'success',
            message: `Successfully upgraded to ${subscriptionService.getTierName(result.subscription.tierId)}!`
          });
          
          // Navigate to subscription page
          setCurrentPage('tiers');
          
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          handleApiError(err, 'Error processing subscription payment');
        } finally {
          setIsLoadingData(false);
        }
      } else if (canceled === 'true') {
        // Handle canceled subscription
        setError({
          type: 'info',
          message: 'Subscription process was canceled.'
        });
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    
    checkSubscriptionRedirect();
  }, [isAuthenticated, showTokenReward, handleApiError]);

  const handleSendAndEarn = () => {
    sendMsg();
    showTokenReward(5, 'chat_message');
  };

  useEffect(() => {
    const streamURL = process.env.REACT_APP_STREAM_URL;
    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
      hls.on(Hls.Events.ERROR, (e, data) => {
        if (data.fatal) {
          if (data.type === 'networkError') hls.startLoad();
          else if (data.type === 'mediaError') hls.recoverMediaError();
          else hls.destroy();
        }
      });
      hls.loadSource(streamURL);
      if (videoRef.current) {
        hls.attachMedia(videoRef.current);
      }
    } else {
      if (videoRef.current) {
        videoRef.current.src = streamURL;
      }
    }

    socket.current = io(process.env.REACT_APP_CHAT_URL);
    socket.current.on('chat message', m => {
      setMsgs(prev => [...prev.slice(-99), m]);
    });

    return () => {
      socket.current.disconnect();
    };
  }, []);

  const sendMsg = () => {
    if (input.trim()) {
      socket.current.emit('chat message', input.trim());
      setInput('');
    }
  };

  const renderCurrentPage = () => {
    // If not authenticated and not on login page, redirect to login
    if (!isAuthenticated && currentPage !== 'login') {
      return <LoginForm onLoginSuccess={handleLoginSuccess} />;
    }
    
    switch (currentPage) {
      case 'login':
        return <LoginForm onLoginSuccess={handleLoginSuccess} />;
      case 'profile':
        return <ErrorBoundary name="Token Wallet">
                  <TokenWallet 
                    userId={user.userId} 
                    onNavigateToBoostShop={handleNavigateToBoostShop} 
                    onNavigateToTiers={handleNavigateToTiers}
                    onError={handleApiError}
                  />
               </ErrorBoundary>;
      case 'boostShop':
        return <ErrorBoundary name="Boost Shop">
                 <BoostShop 
                   userId={user.userId} 
                   onBoostPurchased={(amount) => {
                     console.log(`Boost purchased for ${amount} tokens`);
                     updateTokenBalance(-amount); // Subtract tokens
                   }}
                   onError={handleApiError}
                 />
               </ErrorBoundary>;
      case 'analytics':
        return <ErrorBoundary name="Token Analytics">
                 <TokenAnalytics 
                   userId={user.userId} 
                   onError={handleApiError}
                 />
               </ErrorBoundary>;
      case 'tiers':
        return <ErrorBoundary name="Subscription Manager">
                 <SubscriptionManager 
                   userId={user.userId} 
                   onError={handleApiError}
                   tiers={subscriptionTiers}
                   currentSubscription={currentSubscription}
                   isLoading={isSubscriptionLoading}
                   onSubscriptionChanged={fetchSubscriptionData}
                   onNavigateToStream={handleNavigateToStream}
                 />
               </ErrorBoundary>;
      case 'stream':
      default:
        return (
          <div className="app-container" style={{ display: 'flex', height: '100vh', position: 'relative' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <video
                ref={videoRef}
                controls autoPlay muted
                style={{ flex: 1, background: '#000', minHeight: 0 }}
              />
              <div style={{ padding: '10px', background: '#222', color: 'white' }}>
                <div className="app-controls">
                  {isAuthenticated && (
                    <div className="user-info">
                      <div className="token-display">
                        <span className="token-icon">🪙</span>
                        <span className="token-count">{user?.tokenBalance || 0}</span>
                      </div>
                      {currentSubscription && (
                        <div className="subscription-badge" 
                             style={{ backgroundColor: subscriptionService.getTierColor(currentSubscription.tierId) }}>
                          {subscriptionService.getTierName(currentSubscription.tierId)}
    }
  };

  const renderStreamPage = () => {
    // In a real app, this would fetch the channel info from the API or route params
    
    return (
      <div className="stream-container">
        {/* Video Player */}
        <div className="video-player-container">
          <div className="video-player">
            <video 
              ref={videoRef} 
              controls 
              style={{ width: '100%', height: '100%', backgroundColor: '#000' }} 
            />
          </div>

          {/* Stream Details */}
          <div className="stream-details">
            <h2>Live Stream Title</h2>
            <p>Streamer Name • 1.2k viewers</p>
          </div>
          
          {/* Test Button */}
          <button 
            onClick={() => showTokenReward(50, 'Test Event')}
            className="test-reward-button"
          >
            Trigger Test Reward
          </button>
        </div>

        {/* Integrated Chat System */}
        {streamChannelId && (
          <div className="chat-container">
            <StreamChat 
              isMinimized={isChatMinimized}
              onToggleMinimize={() => setIsChatMinimized(!isChatMinimized)}
            />
          </div>
        )}
      </div>
    );
  };

  // If auth is still loading, show loading state
  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading Clipt...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Global Error Message */}
      {error && (
        <div className="error-toast">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button className="error-close" onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      {/* App Header with Navigation */}
      <header className="app-header">
        <div className="header-logo">
          <h1>Clipt</h1>
        </div>
        
        <nav className="main-nav">
          <button 
            className={`nav-button ${currentPage === 'stream' ? 'active' : ''}`}
            onClick={handleNavigateToStream}
          >
            Stream
          </button>
          
          {isAuthenticated && (
            <>
              <button 
                className={`nav-button ${currentPage === 'profile' ? 'active' : ''}`}
                onClick={handleNavigateToProfile}
              >
                My Wallet
              </button>
              
              <button 
                className={`nav-button ${currentPage === 'boostShop' ? 'active' : ''}`}
                onClick={handleNavigateToBoostShop}
              >
                Boost Shop
              </button>
              
              <button 
                className={`nav-button ${currentPage === 'analytics' ? 'active' : ''}`}
                onClick={handleNavigateToAnalytics}
              >
                Analytics
              </button>
              
              <button 
                className={`nav-button ${currentPage === 'tiers' ? 'active' : ''}`}
                onClick={handleNavigateToTiers}
              >
                Tiers
              </button>
            </>
          )}
        </nav>
        
        <div className="user-section">
          {isAuthenticated ? (
            <>
              <div className="token-display">
                <span className="token-icon">🪙</span>
                <span className="token-count">{user.tokenBalance}</span>
              </div>
              
              <div className="user-profile">
                {user.profilePicture && (
                  <img 
                    src={user.profilePicture} 
                    alt={user.username} 
                    className="profile-picture"
                  />
                )}
                <span className="username">{user.username}</span>
              </div>
            </>
          ) : (
            <button 
              className="login-button"
              onClick={handleNavigateToLogin}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {renderCurrentPage()}
      </main>

      {/* Token Reward Popup */}
      <TokenReward 
        isVisible={rewardInfo.isVisible} 
        amount={rewardInfo.amount} 
        activity={rewardInfo.activity}
        onClose={handleCloseReward}
        onNavigateToProfile={handleNavigateToProfile}
        onNavigateToBoostShop={handleNavigateToBoostShop}
      />
    </div>
  );
}
