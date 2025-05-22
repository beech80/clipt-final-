import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { motion } from 'framer-motion';

/**
 * TokenWallet - Displays user's token balance, tier, limits and transaction history
 * To be shown on the Profile page.
 */
const TokenWallet = ({ userId, onNavigateToBoostShop, onNavigateToTiers }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('balance');
  const [tokensEarnedToday, setTokensEarnedToday] = useState(0);
  
  const ECONOMY_API_URL = 'http://localhost:3004/api';
  
  // Fetch user profile and token data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch user profile with token balance
        const profileResponse = await axios.get(`${ECONOMY_API_URL}/users/${userId}/profile`);
        setUserProfile(profileResponse.data);
        setTokenBalance(profileResponse.data.token_balance || 0);
        
        // Fetch recent transactions
        // Note: This endpoint would need to be added to your backend
        try {
          const transactionsResponse = await axios.get(`${ECONOMY_API_URL}/users/${userId}/transactions?limit=10`);
          setTransactions(transactionsResponse.data.transactions || []);
        } catch (txError) {
          console.warn('Could not fetch transactions history:', txError);
          setTransactions([]);
        }
        
        // Calculate tokens earned today from backend data
        // This would require an endpoint in your backend
        try {
          const statsResponse = await axios.get(`${ECONOMY_API_URL}/users/${userId}/token-stats`);
          setTokensEarnedToday(statsResponse.data.earnedToday || 0);
        } catch (statsError) {
          console.warn('Could not fetch token stats:', statsError);
          // Fallback calculation
          setTokensEarnedToday(0);
        }
        
      } catch (err) {
        console.error('Error fetching token data:', err);
        setError('Could not load your token wallet. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Refresh data every 60 seconds
    const intervalId = setInterval(fetchData, 60000);
    return () => clearInterval(intervalId);
  }, [userId, ECONOMY_API_URL]);
  
  // Get tier-specific details
  const getTierSettings = (tier) => {
    const tiers = {
      free: {
        color: '#CCCCCC',
        dailyLimit: 10,
        walletCap: 200,
        name: 'Free'
      },
      pro: {
        color: '#4E9AF1',
        dailyLimit: 20,
        walletCap: 400,
        name: 'Pro'
      },
      maxed: {
        color: '#F8BF60',
        dailyLimit: 30,
        walletCap: 800,
        name: 'Maxed'
      }
    };
    
    return tiers[tier] || tiers.free;
  };
  
  // Calculate progress percentages
  const getDailyTokenProgress = () => {
    if (!userProfile) return 0;
    const tierSettings = getTierSettings(userProfile.tier);
    return Math.min(100, (tokensEarnedToday / tierSettings.dailyLimit) * 100);
  };
  
  const getWalletCapProgress = () => {
    if (!userProfile) return 0;
    const tierSettings = getTierSettings(userProfile.tier);
    return Math.min(100, (tokenBalance / tierSettings.walletCap) * 100);
  };
  
  // Format transaction date
  const formatTransactionDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Format transaction amount with + or - prefix
  const formatAmount = (amount) => {
    if (amount > 0) return `+${amount}`;
    return amount.toString();
  };
  
  if (isLoading) {
    return (
      <div className="token-wallet-loading" style={{ padding: '20px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ 
          width: '40px', 
          height: '40px', 
          margin: '0 auto',
          border: '4px solid rgba(248, 191, 96, 0.3)',
          borderRadius: '50%',
          borderTop: '4px solid #F8BF60',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p>Loading your wallet...</p>
        
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="token-wallet-error" style={{ 
        padding: '20px', 
        backgroundColor: 'rgba(255, 0, 0, 0.1)', 
        borderRadius: '8px',
        color: '#FF5555' 
      }}>
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} style={{
          backgroundColor: '#8257E5',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Try Again
        </button>
      </div>
    );
  }
  
  const tierSettings = userProfile ? getTierSettings(userProfile.tier) : getTierSettings('free');
  
  return (
    <div className="token-wallet-container" style={{
      backgroundColor: '#1E1E2E',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      width: '100%',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      {/* Header with tier badge */}
      <div className="wallet-header" style={{
        backgroundColor: '#262640',
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h2 style={{ margin: 0, color: 'white' }}>Clipt Coins</h2>
        <div className="tier-badge" style={{
          backgroundColor: tierSettings.color,
          color: '#000',
          padding: '6px 12px',
          borderRadius: '20px',
          fontWeight: 'bold',
          fontSize: '14px',
          cursor: 'pointer'
        }} onClick={onNavigateToTiers}>
          {tierSettings.name}
        </div>
      </div>
      
      {/* Tab navigation */}
      <div className="wallet-tabs" style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <button 
          onClick={() => setActiveTab('balance')}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: activeTab === 'balance' ? '#2A2A45' : 'transparent',
            color: 'white',
            border: 'none',
            borderBottom: activeTab === 'balance' ? '2px solid #F8BF60' : 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'balance' ? 'bold' : 'normal'
          }}
        >
          Balance
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: activeTab === 'history' ? '#2A2A45' : 'transparent',
            color: 'white',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid #F8BF60' : 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'history' ? 'bold' : 'normal'
          }}
        >
          History
        </button>
      </div>
      
      {/* Balance tab content */}
      {activeTab === 'balance' && (
        <div className="balance-content" style={{ padding: '20px' }}>
          {/* Token balance */}
          <div className="token-balance" style={{ 
            textAlign: 'center', 
            marginBottom: '24px',
            position: 'relative'
          }}>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              style={{
                position: 'relative',
                zIndex: 1
              }}
            >
              <div className="coin-icon" style={{ fontSize: '48px', marginBottom: '8px' }}>🪙</div>
              <h1 style={{ fontSize: '48px', color: '#F8BF60', margin: '0' }}>{tokenBalance}</h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: '4px 0 0' }}>Clipt Coins</p>
            </motion.div>
            
            {/* Optional glowing background effect */}
            <div style={{
              position: 'absolute',
              width: '200px',
              height: '200px',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(248, 191, 96, 0.2) 0%, rgba(30, 30, 46, 0) 70%)',
              zIndex: 0
            }}/>
          </div>
          
          {/* Daily token limit progress */}
          <div className="progress-section" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: 'white' }}>Daily Tokens</span>
              <span style={{ color: 'white' }}>{tokensEarnedToday} / {tierSettings.dailyLimit}</span>
            </div>
            <div style={{ 
              height: '10px', 
              backgroundColor: 'rgba(255, 255, 255, 0.1)', 
              borderRadius: '5px', 
              overflow: 'hidden' 
            }}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${getDailyTokenProgress()}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{ 
                  height: '100%', 
                  backgroundColor: '#8257E5',
                  borderRadius: '5px'
                }}
              />
            </div>
          </div>
          
          {/* Wallet cap progress */}
          <div className="progress-section" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: 'white' }}>Wallet Capacity</span>
              <span style={{ color: 'white' }}>{tokenBalance} / {tierSettings.walletCap}</span>
            </div>
            <div style={{ 
              height: '10px', 
              backgroundColor: 'rgba(255, 255, 255, 0.1)', 
              borderRadius: '5px', 
              overflow: 'hidden' 
            }}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${getWalletCapProgress()}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{ 
                  height: '100%', 
                  backgroundColor: '#F8BF60',
                  borderRadius: '5px'
                }}
              />
            </div>
          </div>
          
          {/* Boost shop button */}
          <button 
            onClick={onNavigateToBoostShop}
            style={{
              width: '100%',
              backgroundColor: '#F8BF60',
              color: '#1E1E2E',
              padding: '14px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '20px' }}>🚀</span>
            VISIT BOOST SHOP
          </button>
        </div>
      )}
      
      {/* Transaction history tab content */}
      {activeTab === 'history' && (
        <div className="history-content" style={{ padding: '10px 0' }}>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255, 255, 255, 0.5)' }}>
              <p>No transaction history yet.</p>
              <p>Earn tokens by posting clips, going live, and more!</p>
            </div>
          ) : (
            <ul style={{ 
              listStyle: 'none', 
              margin: 0, 
              padding: 0,
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              {transactions.map((transaction, index) => (
                <li key={index} style={{
                  borderBottom: index < transactions.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ color: 'white', marginBottom: '4px' }}>{transaction.reason}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                      {formatTransactionDate(transaction.created_at)}
                    </div>
                  </div>
                  <div style={{ 
                    fontWeight: 'bold',
                    color: transaction.change_amount > 0 ? '#4CAF50' : transaction.change_amount < 0 ? '#F8BF60' : 'white'
                  }}>
                    {formatAmount(transaction.change_amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

TokenWallet.propTypes = {
  userId: PropTypes.string.isRequired,
  onNavigateToBoostShop: PropTypes.func.isRequired,
  onNavigateToTiers: PropTypes.func.isRequired
};

export default TokenWallet;
