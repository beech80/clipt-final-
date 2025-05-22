import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './StreamChat.css';

/**
 * DonationPanel Component
 * 
 * Provides an interface for users to donate tokens to streamers through chat
 * Features:
 * - Preset donation amounts
 * - Custom donation amount option
 * - Token balance display
 * - Donation message
 * - Special effects selection for higher donations
 */
const DonationPanel = ({ onDonate, onClose, user }) => {
  // State
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [selectedEffect, setSelectedEffect] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(user?.tokenBalance || 0);
  const [error, setError] = useState('');
  
  // Preset donation amounts
  const donationAmounts = [10, 20, 50, 100];
  
  // Special effects available based on donation amount
  const specialEffects = [
    { id: 'regular', name: 'Regular', minAmount: 0, description: 'Standard chat message' },
    { id: 'highlighted', name: 'Highlighted', minAmount: 20, description: 'Your message stands out in chat' },
    { id: 'animated', name: 'Animated', minAmount: 50, description: 'Animated message with special effect' },
    { id: 'super', name: 'Super Chat', minAmount: 100, description: 'Pinned message at the top of chat for 2 minutes' }
  ];
  
  // Fetch user's token balance
  useEffect(() => {
    const fetchTokenBalance = async () => {
      try {
        // In a real implementation, this would be an API call
        // For now, we'll use the user object passed as a prop
        setTokenBalance(user?.tokenBalance || 0);
      } catch (error) {
        console.error('Error fetching token balance:', error);
      }
    };
    
    fetchTokenBalance();
  }, [user]);
  
  // Handle preset amount selection
  const handleAmountClick = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    
    // Auto-select appropriate effect based on amount
    const availableEffects = specialEffects.filter(effect => amount >= effect.minAmount);
    if (availableEffects.length > 0) {
      setSelectedEffect(availableEffects[availableEffects.length - 1].id);
    }
    
    // Clear any error
    setError('');
  };
  
  // Handle custom amount input
  const handleCustomAmountChange = (e) => {
    const value = e.target.value.trim();
    
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) {
      return;
    }
    
    setCustomAmount(value);
    setSelectedAmount(null);
    
    // Auto-select appropriate effect based on amount
    if (value) {
      const numValue = parseInt(value, 10);
      const availableEffects = specialEffects.filter(effect => numValue >= effect.minAmount);
      if (availableEffects.length > 0) {
        setSelectedEffect(availableEffects[availableEffects.length - 1].id);
      }
    }
    
    // Clear any error
    setError('');
  };
  
  // Handle message input
  const handleMessageChange = (e) => {
    setMessage(e.target.value);
  };
  
  // Handle effect selection
  const handleEffectChange = (effectId) => {
    setSelectedEffect(effectId);
  };
  
  // Handle donation submission
  const handleSubmit = () => {
    // Get actual donation amount
    const amount = selectedAmount || parseInt(customAmount, 10);
    
    // Validate amount
    if (!amount || amount <= 0) {
      setError('Please select or enter a valid donation amount');
      return;
    }
    
    // Validate token balance
    if (amount > tokenBalance) {
      setError('Insufficient token balance');
      return;
    }
    
    // Validate effect (if selected)
    if (selectedEffect) {
      const effect = specialEffects.find(e => e.id === selectedEffect);
      if (effect && amount < effect.minAmount) {
        setError(`Minimum ${effect.minAmount} tokens required for ${effect.name} effect`);
        return;
      }
    }
    
    // Submit donation
    setIsSubmitting(true);
    
    try {
      onDonate(amount, message, selectedEffect);
      
      // Clear form
      setSelectedAmount(null);
      setCustomAmount('');
      setMessage('');
      setSelectedEffect(null);
      
      // Close panel
      onClose();
    } catch (error) {
      console.error('Error submitting donation:', error);
      setError('Failed to submit donation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Check if the submit button should be disabled
  const isSubmitDisabled = () => {
    const amount = selectedAmount || parseInt(customAmount, 10) || 0;
    return isSubmitting || amount <= 0 || amount > tokenBalance;
  };
  
  return (
    <motion.div 
      className="donation-panel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="donation-panel-header">
        <div className="donation-panel-title">Donate Tokens</div>
        <button className="donation-panel-close" onClick={onClose}>×</button>
      </div>
      
      <div className="donation-panel-content">
        {/* Token balance */}
        <div className="donation-token-balance">
          Your balance: <span className="donation-token-value">{tokenBalance} Tokens</span>
        </div>
        
        {/* Preset amounts */}
        <div className="donation-amounts">
          {donationAmounts.map(amount => (
            <button
              key={amount}
              className={`donation-amount-button ${selectedAmount === amount ? 'selected' : ''}`}
              onClick={() => handleAmountClick(amount)}
            >
              {amount} Tokens
            </button>
          ))}
        </div>
        
        {/* Custom amount */}
        <div className="donation-custom-amount">
          <input
            type="text"
            placeholder="Custom amount"
            value={customAmount}
            onChange={handleCustomAmountChange}
          />
        </div>
        
        {/* Special effects (only show for amounts >= 20) */}
        {(selectedAmount >= 20 || parseInt(customAmount, 10) >= 20) && (
          <div className="donation-effects">
            <div className="donation-section-title" style={{ fontSize: '14px', marginBottom: '10px' }}>
              Special Effect
            </div>
            
            <div className="donation-effects-list" style={{ marginBottom: '15px' }}>
              {specialEffects
                .filter(effect => {
                  const amount = selectedAmount || parseInt(customAmount, 10) || 0;
                  return amount >= effect.minAmount;
                })
                .map(effect => (
                  <div 
                    key={effect.id}
                    className="donation-effect-option"
                    style={{
                      padding: '8px',
                      marginBottom: '5px',
                      border: `1px solid ${selectedEffect === effect.id ? 'var(--chat-btn-hover)' : 'var(--chat-border)'}`,
                      borderRadius: '4px',
                      backgroundColor: selectedEffect === effect.id ? 'rgba(145, 71, 255, 0.1)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleEffectChange(effect.id)}
                  >
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{effect.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--chat-text-muted)' }}>{effect.description}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
        
        {/* Message */}
        <div className="donation-message-input">
          <textarea
            placeholder="Add a message (optional)"
            value={message}
            onChange={handleMessageChange}
            maxLength={200}
          />
          <div style={{ fontSize: '12px', color: 'var(--chat-text-muted)', textAlign: 'right' }}>
            {message.length}/200
          </div>
        </div>
        
        {/* Error message */}
        {error && (
          <div style={{ color: 'var(--chat-error)', fontSize: '14px', marginBottom: '15px' }}>
            {error}
          </div>
        )}
        
        {/* Submit button */}
        <button
          className="donation-submit"
          onClick={handleSubmit}
          disabled={isSubmitDisabled()}
        >
          {isSubmitting ? 'Processing...' : 'Send Donation'}
        </button>
      </div>
    </motion.div>
  );
};

export default DonationPanel;
