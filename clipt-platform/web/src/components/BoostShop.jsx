import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * BoostShop - Component for browsing and purchasing token boosts
 * Shows all available boosts with prices, discounts, and effects
 */
const BoostShop = ({ userId, onBoostPurchased }) => {
  const [availableBoosts, setAvailableBoosts] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBoost, setSelectedBoost] = useState(null);
  const [purchaseStatus, setPurchaseStatus] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [targetContent, setTargetContent] = useState('');
  
  const ECONOMY_API_URL = 'http://localhost:3004/api';
  
  // Define boost category names and descriptions
  const boostCategories = {
    content: {
      name: 'Content Boosts',
      description: 'Amplify your clips and posts to reach more viewers',
      icon: '📹',
      boostTypes: ['squad_blast', 'chain_reaction']
    },
    stream: {
      name: 'Stream Boosts',
      description: 'Increase your stream visibility and attract more viewers',
      icon: '🔴',
      boostTypes: ['im_the_king_now', 'stream_surge']
    }
  };
  
  // Fetch available boosts and user profile
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch user profile with token balance
        const profileResponse = await axios.get(`${ECONOMY_API_URL}/users/${userId}/profile`);
        setUserProfile(profileResponse.data);
        setTokenBalance(profileResponse.data.token_balance || 0);
        
        // Fetch available boosts
        const boostsResponse = await axios.get(`${ECONOMY_API_URL}/users/${userId}/boosts`);
        setAvailableBoosts(boostsResponse.data.boosts || []);
        
      } catch (err) {
        console.error('Error fetching boost data:', err);
        setError('Could not load boost shop. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [userId, ECONOMY_API_URL]);
  
  // Purchase a boost
  const purchaseBoost = async (boostType, targetId = null) => {
    try {
      setPurchaseStatus('processing');
      
      const response = await axios.post(
        `${ECONOMY_API_URL}/users/${userId}/boost/purchase`,
        { boostType, targetId }
      );
      
      // Update token balance
      setTokenBalance(response.data.newBalance);
      
      // Refresh available boosts
      const boostsResponse = await axios.get(`${ECONOMY_API_URL}/users/${userId}/boosts`);
      setAvailableBoosts(boostsResponse.data.boosts || []);
      
      setPurchaseStatus('success');
      
      // Callback to parent
      if (onBoostPurchased) {
        onBoostPurchased(response.data);
      }
      
      // Reset states after delay
      setTimeout(() => {
        setPurchaseStatus(null);
        setShowConfirmation(false);
        setSelectedBoost(null);
      }, 3000);
      
      return response.data;
      
    } catch (err) {
      console.error(`Error purchasing ${boostType} boost:`, err);
      setPurchaseStatus('error');
      
      // Reset error state after delay
      setTimeout(() => {
        setPurchaseStatus(null);
      }, 3000);
      
      if (err.response && err.response.data && err.response.data.error) {
        return { error: err.response.data.error };
      }
      return { error: 'Failed to purchase boost. Please try again.' };
    }
  };
  
  // Handle boost click to show confirmation
  const handleBoostClick = (boost) => {
    setSelectedBoost(boost);
    setShowConfirmation(true);
  };
  
  // Handle confirmation dialog close
  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    setSelectedBoost(null);
    setTargetContent('');
    setPurchaseStatus(null);
  };
  
  // Handle confirm purchase
  const handleConfirmPurchase = () => {
    if (selectedBoost) {
      purchaseBoost(selectedBoost.type, targetContent || null);
    }
  };
  
  // Group boosts by category
  const getBoostsByCategory = () => {
    const categorized = {};
    
    Object.keys(boostCategories).forEach(categoryKey => {
      const category = boostCategories[categoryKey];
      const boosts = availableBoosts.filter(boost => 
        category.boostTypes.includes(boost.type)
      );
      
      if (boosts.length > 0) {
        categorized[categoryKey] = {
          ...category,
          boosts
        };
      }
    });
    
    // Add an "All Boosts" category if there are any uncategorized boosts
    const uncategorizedBoosts = availableBoosts.filter(boost => {
      return !Object.values(boostCategories).some(category => 
        category.boostTypes.includes(boost.type)
      );
    });
    
    if (uncategorizedBoosts.length > 0) {
      categorized.other = {
        name: 'Other Boosts',
        description: 'Special boosts and limited-time offers',
        icon: '✨',
        boosts: uncategorizedBoosts
      };
    }
    
    return categorized;
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="boost-shop-loading" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚀</div>
        <div className="loading-pulse" style={{ 
          width: '200px', 
          height: '6px', 
          backgroundColor: 'rgba(248, 191, 96, 0.2)', 
          margin: '0 auto',
          borderRadius: '3px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '50%',
            backgroundColor: '#F8BF60',
            borderRadius: '3px',
            animation: 'pulse 1.5s infinite ease-in-out'
          }}></div>
        </div>
        <p style={{ marginTop: '20px', color: 'rgba(255, 255, 255, 0.7)' }}>Loading Boost Shop...</p>
        
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { transform: translateX(-100%); }
            50% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="boost-shop-error" style={{ 
        padding: '30px', 
        backgroundColor: 'rgba(255, 0, 0, 0.1)', 
        borderRadius: '8px',
        color: '#FF5555',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <h3>Could Not Load Boost Shop</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} style={{
          backgroundColor: '#8257E5',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}>
          Try Again
        </button>
      </div>
    );
  }
  
  // Empty state
  if (availableBoosts.length === 0) {
    return (
      <div className="boost-shop-empty" style={{ 
        padding: '50px 20px', 
        textAlign: 'center',
        backgroundColor: '#1E1E2E',
        borderRadius: '16px',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>😢</div>
        <h2 style={{ color: 'white', marginBottom: '12px' }}>No Boosts Available</h2>
        <p style={{ color: 'rgba(255, 255, 255, 0.7)', maxWidth: '400px', margin: '0 auto' }}>
          Looks like there are no boosts available right now. Check back later for new opportunities to boost your content!
        </p>
      </div>
    );
  }
  
  const categorizedBoosts = getBoostsByCategory();
  
  return (
    <div className="boost-shop-container" style={{
      maxWidth: '1000px',
      margin: '0 auto'
    }}>
      {/* Shop header */}
      <div className="shop-header" style={{
        backgroundColor: '#1E1E2E',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ color: 'white', margin: '0 0 8px 0' }}>Boost Shop</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
            Use your Clipt Coins to boost your content and streams
          </p>
        </div>
        
        <div className="wallet-indicator" style={{
          backgroundColor: '#262640',
          padding: '12px 20px',
          borderRadius: '50px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '24px' }}>🪙</span>
          <span style={{ 
            color: '#F8BF60', 
            fontWeight: 'bold', 
            fontSize: '20px' 
          }}>
            {tokenBalance}
          </span>
        </div>
      </div>
      
      {/* Boost categories */}
      {Object.keys(categorizedBoosts).map((categoryKey) => {
        const category = categorizedBoosts[categoryKey];
        return (
          <div key={categoryKey} className="boost-category" style={{
            backgroundColor: '#1E1E2E',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div className="category-header" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '20px',
              gap: '12px'
            }}>
              <div style={{ fontSize: '32px' }}>{category.icon}</div>
              <div>
                <h2 style={{ color: 'white', margin: '0 0 4px 0' }}>{category.name}</h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>{category.description}</p>
              </div>
            </div>
            
            <div className="boosts-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '20px'
            }}>
              {category.boosts.map((boost) => (
                <motion.div 
                  key={boost.type}
                  whileHover={{ y: -5, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)' }}
                  className="boost-card" 
                  style={{
                    backgroundColor: '#262640',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: boost.canAfford || boost.freeBoostAvailable ? 'pointer' : 'not-allowed',
                    opacity: boost.canAfford || boost.freeBoostAvailable ? 1 : 0.7,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => {
                    if (boost.canAfford || boost.freeBoostAvailable) {
                      handleBoostClick(boost);
                    }
                  }}
                >
                  {/* Free badge */}
                  {boost.freeBoostAvailable && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      fontSize: '12px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}>
                      FREE
                    </div>
                  )}
                  
                  {/* Discount badge */}
                  {!boost.freeBoostAvailable && boost.discount > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      backgroundColor: '#F44336',
                      color: 'white',
                      fontSize: '12px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}>
                      {boost.discount}% OFF
                    </div>
                  )}
                  
                  <h3 style={{ color: 'white', margin: '0 0 8px 0' }}>{boost.name}</h3>
                  
                  <p style={{ 
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '14px',
                    minHeight: '60px',
                    margin: '0 0 16px 0'
                  }}>
                    {boost.effect}
                  </p>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center'
                  }}>
                    <div className="boost-price" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '18px' }}>🪙</span>
                      
                      {/* Show original price with strikethrough if discounted */}
                      {boost.discount > 0 && !boost.freeBoostAvailable && (
                        <span style={{ 
                          color: 'rgba(255, 255, 255, 0.5)',
                          textDecoration: 'line-through',
                          fontSize: '14px',
                          marginRight: '4px'
                        }}>
                          {boost.originalCost}
                        </span>
                      )}
                      
                      {/* Show discounted or free price */}
                      <span style={{ 
                        color: boost.freeBoostAvailable ? '#4CAF50' : '#F8BF60', 
                        fontWeight: 'bold'
                      }}>
                        {boost.freeBoostAvailable ? 'FREE' : boost.discountedCost}
                      </span>
                    </div>
                    
                    <button style={{
                      backgroundColor: boost.canAfford || boost.freeBoostAvailable ? '#8257E5' : '#555',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: boost.canAfford || boost.freeBoostAvailable ? 'pointer' : 'not-allowed'
                    }}>
                      {boost.freeBoostAvailable ? 'Use Free' : 'Purchase'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })}
      
      {/* Purchase confirmation modal */}
      <AnimatePresence>
        {showConfirmation && selectedBoost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 1000,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{
                backgroundColor: '#1E1E2E',
                borderRadius: '16px',
                padding: '30px',
                maxWidth: '500px',
                width: '100%',
                position: 'relative',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
              }}
            >
              {/* Close button */}
              <button
                onClick={handleCloseConfirmation}
                style={{
                  position: 'absolute',
                  top: '15px',
                  right: '15px',
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: 'pointer',
                  opacity: 0.7
                }}
              >
                ×
              </button>
              
              {/* Confirmation content */}
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: 'white', marginTop: 0 }}>
                  {purchaseStatus === 'success' ? 'Boost Activated!' : 'Confirm Purchase'}
                </h2>
                
                {purchaseStatus === null && (
                  <>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      You are about to {selectedBoost.freeBoostAvailable ? 'use your free' : 'purchase'} {selectedBoost.name} boost
                      {!selectedBoost.freeBoostAvailable && (
                        <span> for <span style={{ color: '#F8BF60', fontWeight: 'bold' }}>
                          {selectedBoost.discountedCost} Clipt Coins
                        </span></span>
                      )}
                    </p>
                    
                    <div style={{ 
                      backgroundColor: '#262640',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '20px'
                    }}>
                      <p style={{ margin: 0, color: 'white' }}>{selectedBoost.effect}</p>
                    </div>
                    
                    {/* Optional target content field for some boosts */}
                    {(selectedBoost.type === 'squad_blast' || 
                      selectedBoost.type === 'chain_reaction') && (
                      <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                        <label style={{ color: 'white', display: 'block', marginBottom: '8px' }}>
                          Content ID to boost (optional):
                        </label>
                        <input 
                          type="text"
                          value={targetContent}
                          onChange={(e) => setTargetContent(e.target.value)}
                          placeholder="Enter content ID or URL"
                          style={{
                            width: '100%',
                            padding: '10px',
                            backgroundColor: '#383854',
                            border: '1px solid #555',
                            borderRadius: '4px',
                            color: 'white'
                          }}
                        />
                      </div>
                    )}
                    
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      gap: '16px', 
                      marginTop: '24px' 
                    }}>
                      <button
                        onClick={handleCloseConfirmation}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '16px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      
                      <button
                        onClick={handleConfirmPurchase}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: selectedBoost.freeBoostAvailable ? '#4CAF50' : '#F8BF60',
                          color: selectedBoost.freeBoostAvailable ? 'white' : '#1E1E2E',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        {selectedBoost.freeBoostAvailable ? 'Use Free Boost' : 'Confirm Purchase'}
                      </button>
                    </div>
                  </>
                )}
                
                {purchaseStatus === 'processing' && (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    padding: '20px' 
                  }}>
                    <div className="processing-spinner" style={{ 
                      width: '40px', 
                      height: '40px', 
                      border: '4px solid rgba(248, 191, 96, 0.3)',
                      borderRadius: '50%',
                      borderTop: '4px solid #F8BF60',
                      animation: 'spin 1s linear infinite',
                      marginBottom: '20px'
                    }}></div>
                    <p style={{ color: 'white' }}>Processing your purchase...</p>
                    
                    <style jsx>{`
                      @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                    `}</style>
                  </div>
                )}
                
                {purchaseStatus === 'success' && (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    padding: '20px' 
                  }}>
                    <div style={{ 
                      width: '64px', 
                      height: '64px', 
                      backgroundColor: '#4CAF50',
                      borderRadius: '50%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: '20px',
                      fontSize: '32px'
                    }}>
                      ✓
                    </div>
                    <p style={{ color: 'white', marginBottom: '20px' }}>
                      {selectedBoost.name} boost has been successfully activated!
                    </p>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      New balance: <span style={{ color: '#F8BF60', fontWeight: 'bold' }}>{tokenBalance} Clipt Coins</span>
                    </p>
                  </div>
                )}
                
                {purchaseStatus === 'error' && (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    padding: '20px' 
                  }}>
                    <div style={{ 
                      width: '64px', 
                      height: '64px', 
                      backgroundColor: '#F44336',
                      borderRadius: '50%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: '20px',
                      fontSize: '32px'
                    }}>
                      ×
                    </div>
                    <p style={{ color: 'white', marginBottom: '20px' }}>
                      Failed to purchase boost. Please try again.
                    </p>
                    <button
                      onClick={handleCloseConfirmation}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#8257E5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        cursor: 'pointer'
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

BoostShop.propTypes = {
  userId: PropTypes.string.isRequired,
  onBoostPurchased: PropTypes.func
};

BoostShop.defaultProps = {
  onBoostPurchased: null
};

export default BoostShop;
