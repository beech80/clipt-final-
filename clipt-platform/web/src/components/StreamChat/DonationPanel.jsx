import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import emoteService from '../../services/emoteService';
import api from '../../services/api';
import './DonationPanel.scss';

const DonationPanel = ({ 
  onSendDonation, 
  availableEmotes = [], 
  channelInfo, 
  onClose 
}) => {
  const currentUser = useSelector(state => state.auth.user);
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState(100);
  const [userBalance, setUserBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showEffectsMenu, setShowEffectsMenu] = useState(false);
  const [selectedEffects, setSelectedEffects] = useState({
    highlight: false,
    confetti: false,
    sound: null,
    animation: null
  });
  const [effectsCost, setEffectsCost] = useState(0);
  const [topDonors, setTopDonors] = useState([]);

  // Effect price list
  const effectPrices = {
    highlight: 50,
    confetti: 100,
    sound: {
      airhorn: 150,
      applause: 150,
      drum: 100,
      tada: 100
    },
    animation: {
      rain: 200,
      explosion: 300,
      hearts: 200,
      fire: 250
    }
  };

  // Default donation amounts
  const defaultAmounts = [50, 100, 500, 1000, 5000];

  // Load user balance
  useEffect(() => {
    if (currentUser) {
      const fetchUserBalance = async () => {
        try {
          const response = await api.get('/api/tokens/balance');
          setUserBalance(response.data.balance);
        } catch (error) {
          console.error('Error fetching token balance:', error);
          toast.error('Failed to load your token balance');
        }
      };

      fetchUserBalance();
    }
  }, [currentUser]);

  // Load top donors
  useEffect(() => {
    if (channelInfo) {
      const fetchTopDonors = async () => {
        try {
          const response = await api.get(`/api/chat/top-donors/${channelInfo._id}?limit=5`);
          setTopDonors(response.data);
        } catch (error) {
          console.error('Error fetching top donors:', error);
        }
      };

      fetchTopDonors();
    }
  }, [channelInfo]);

  // Calculate total effects cost
  useEffect(() => {
    let cost = 0;

    if (selectedEffects.highlight) {
      cost += effectPrices.highlight;
    }

    if (selectedEffects.confetti) {
      cost += effectPrices.confetti;
    }

    if (selectedEffects.sound) {
      cost += effectPrices.sound[selectedEffects.sound];
    }

    if (selectedEffects.animation) {
      cost += effectPrices.animation[selectedEffects.animation];
    }

    setEffectsCost(cost);
  }, [selectedEffects]);

  // Handle donation submission
  const handleSubmit = async () => {
    if (!amount || amount < 50) {
      toast.error('Minimum donation amount is 50 tokens');
      return;
    }

    if (amount > userBalance) {
      toast.error('You don\'t have enough tokens');
      return;
    }

    // Show confirmation for large donations
    if (amount >= 1000 && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsLoading(true);

    const totalCost = parseInt(amount) + effectsCost;

    // Parse emotes in message
    const { parsedContent, emotes } = emoteService.parseEmotes(message, availableEmotes);

    try {
      // First deduct tokens from balance
      await api.post('/api/tokens/deduct', {
        amount: totalCost,
        description: `Donation to ${channelInfo.displayName || channelInfo.username}`
      });

      // Then send the donation
      onSendDonation(amount, parsedContent, {
        ...selectedEffects,
        emotes: emotes.map(e => e.id)
      });

      // Reset form
      setMessage('');
      setAmount(100);
      setSelectedEffects({
        highlight: false,
        confetti: false,
        sound: null,
        animation: null
      });
      setShowConfirmation(false);

      // Update user balance
      setUserBalance(prev => prev - totalCost);

      toast.success('Donation sent successfully!');
      onClose();
    } catch (error) {
      console.error('Error sending donation:', error);
      toast.error('Failed to send donation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle effect selection
  const toggleEffect = (category, value) => {
    setSelectedEffects(prev => {
      // If it's the same value, toggle it off
      if (category === 'highlight' || category === 'confetti') {
        return {
          ...prev,
          [category]: !prev[category]
        };
      } else {
        // For sound and animation, set to null if same, otherwise change
        return {
          ...prev,
          [category]: prev[category] === value ? null : value
        };
      }
    });
  };

  // Format token amount with commas
  const formatTokens = (tokens) => {
    return tokens.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  return (
    <div className="donation-panel">
      <div className="donation-panel__header">
        <h3 className="donation-panel__title">
          Send a Donation
          <span className="donation-panel__subtitle">
            to {channelInfo?.displayName || channelInfo?.username}
          </span>
        </h3>
        <button className="donation-panel__close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="donation-panel__content">
        <div className="donation-panel__balance">
          <span className="donation-panel__balance-label">Your Balance:</span>
          <span className="donation-panel__balance-amount">
            <i className="fas fa-coins"></i> {formatTokens(userBalance)} tokens
          </span>
        </div>

        <div className="donation-panel__amount-section">
          <label className="donation-panel__label">
            Donation Amount:
          </label>
          
          <div className="donation-panel__preset-amounts">
            {defaultAmounts.map(amt => (
              <button
                key={amt}
                className={`donation-panel__preset-btn ${amount === amt ? 'donation-panel__preset-btn--active' : ''}`}
                onClick={() => setAmount(amt)}
              >
                {formatTokens(amt)}
              </button>
            ))}
          </div>
          
          <div className="donation-panel__custom-amount">
            <input
              type="number"
              min="50"
              value={amount}
              onChange={e => setAmount(Math.max(50, parseInt(e.target.value) || 0))}
              className="donation-panel__amount-input"
            />
            <span className="donation-panel__amount-suffix">tokens</span>
          </div>
        </div>

        <div className="donation-panel__message-section">
          <label className="donation-panel__label">
            Message (optional):
          </label>
          <textarea
            className="donation-panel__message-input"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Add a message with your donation..."
            maxLength={200}
          />
          <div className="donation-panel__message-footer">
            <span className="donation-panel__message-counter">
              {message.length}/200
            </span>
            <button
              className="donation-panel__emote-btn"
              onClick={e => {
                e.preventDefault();
                setShowEffectsMenu(false);
                // In a real app, we'd show an emote picker here
                toast.info('Emote picker is not implemented in this example');
              }}
            >
              <i className="far fa-smile"></i> Add Emote
            </button>
          </div>
        </div>

        <div className="donation-panel__effects-section">
          <div className="donation-panel__effects-header">
            <label className="donation-panel__label">
              Special Effects:
            </label>
            <span className="donation-panel__effects-cost">
              +{formatTokens(effectsCost)} tokens
            </span>
            <button
              className={`donation-panel__effects-toggle ${showEffectsMenu ? 'donation-panel__effects-toggle--active' : ''}`}
              onClick={() => setShowEffectsMenu(!showEffectsMenu)}
            >
              {showEffectsMenu ? 'Hide Effects' : 'Show Effects'}
              <i className={`fas fa-chevron-${showEffectsMenu ? 'up' : 'down'}`}></i>
            </button>
          </div>

          <AnimatePresence>
            {showEffectsMenu && (
              <motion.div
                className="donation-panel__effects-menu"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="donation-panel__effects-group">
                  <h4 className="donation-panel__effects-group-title">Appearance</h4>
                  <div className="donation-panel__effects-options">
                    <label className={`donation-panel__effect-item ${selectedEffects.highlight ? 'donation-panel__effect-item--active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedEffects.highlight}
                        onChange={() => toggleEffect('highlight', true)}
                        className="donation-panel__effect-checkbox"
                      />
                      <div className="donation-panel__effect-info">
                        <span className="donation-panel__effect-name">Highlight</span>
                        <span className="donation-panel__effect-price">+{effectPrices.highlight}</span>
                      </div>
                    </label>
                    
                    <label className={`donation-panel__effect-item ${selectedEffects.confetti ? 'donation-panel__effect-item--active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedEffects.confetti}
                        onChange={() => toggleEffect('confetti', true)}
                        className="donation-panel__effect-checkbox"
                      />
                      <div className="donation-panel__effect-info">
                        <span className="donation-panel__effect-name">Confetti</span>
                        <span className="donation-panel__effect-price">+{effectPrices.confetti}</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="donation-panel__effects-group">
                  <h4 className="donation-panel__effects-group-title">Sound Effects</h4>
                  <div className="donation-panel__effects-options">
                    {Object.entries(effectPrices.sound).map(([id, price]) => (
                      <label
                        key={id}
                        className={`donation-panel__effect-item ${selectedEffects.sound === id ? 'donation-panel__effect-item--active' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEffects.sound === id}
                          onChange={() => toggleEffect('sound', id)}
                          className="donation-panel__effect-checkbox"
                        />
                        <div className="donation-panel__effect-info">
                          <span className="donation-panel__effect-name">{id.charAt(0).toUpperCase() + id.slice(1)}</span>
                          <span className="donation-panel__effect-price">+{price}</span>
                        </div>
                        <button
                          className="donation-panel__effect-preview"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // In a real app, we'd play a sound preview here
                            toast.info(`Playing ${id} sound preview`);
                          }}
                        >
                          <i className="fas fa-volume-up"></i>
                        </button>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="donation-panel__effects-group">
                  <h4 className="donation-panel__effects-group-title">Animations</h4>
                  <div className="donation-panel__effects-options">
                    {Object.entries(effectPrices.animation).map(([id, price]) => (
                      <label
                        key={id}
                        className={`donation-panel__effect-item ${selectedEffects.animation === id ? 'donation-panel__effect-item--active' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEffects.animation === id}
                          onChange={() => toggleEffect('animation', id)}
                          className="donation-panel__effect-checkbox"
                        />
                        <div className="donation-panel__effect-info">
                          <span className="donation-panel__effect-name">{id.charAt(0).toUpperCase() + id.slice(1)}</span>
                          <span className="donation-panel__effect-price">+{price}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="donation-panel__top-donors">
          <h4 className="donation-panel__donors-title">Top Donors</h4>
          {topDonors.length > 0 ? (
            <div className="donation-panel__donors-list">
              {topDonors.map((donor, index) => (
                <div key={donor.userId} className="donation-panel__donor">
                  <span className="donation-panel__donor-rank">#{index + 1}</span>
                  <span className="donation-panel__donor-name">{donor.username}</span>
                  <span className="donation-panel__donor-amount">
                    {formatTokens(donor.totalAmount)} tokens
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="donation-panel__donors-empty">
              <p>Be the first to donate!</p>
            </div>
          )}
        </div>

        <div className="donation-panel__summary">
          <div className="donation-panel__summary-row">
            <span>Donation:</span>
            <span>{formatTokens(amount)} tokens</span>
          </div>
          {effectsCost > 0 && (
            <div className="donation-panel__summary-row">
              <span>Effects:</span>
              <span>+{formatTokens(effectsCost)} tokens</span>
            </div>
          )}
          <div className="donation-panel__summary-row donation-panel__summary-row--total">
            <span>Total:</span>
            <span>{formatTokens(parseInt(amount) + effectsCost)} tokens</span>
          </div>
        </div>
      </div>

      <div className="donation-panel__footer">
        <button
          className="donation-panel__cancel-btn"
          onClick={onClose}
          disabled={isLoading}
        >
          Cancel
        </button>
        
        <button
          className="donation-panel__send-btn"
          onClick={handleSubmit}
          disabled={isLoading || amount <= 0 || amount > userBalance}
        >
          {isLoading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i> Processing...
            </>
          ) : (
            <>
              <i className="fas fa-paper-plane"></i> Send Donation
            </>
          )}
        </button>
      </div>

      {showConfirmation && (
        <div className="donation-panel__confirmation-overlay">
          <div className="donation-panel__confirmation">
            <h4 className="donation-panel__confirmation-title">
              <i className="fas fa-exclamation-triangle"></i> Confirm Large Donation
            </h4>
            <p className="donation-panel__confirmation-message">
              You are about to donate <strong>{formatTokens(parseInt(amount) + effectsCost)} tokens</strong> to {channelInfo?.displayName || channelInfo?.username}. Are you sure?
            </p>
            <div className="donation-panel__confirmation-actions">
              <button
                className="donation-panel__confirmation-cancel"
                onClick={() => setShowConfirmation(false)}
              >
                Cancel
              </button>
              <button
                className="donation-panel__confirmation-confirm"
                onClick={() => {
                  setShowConfirmation(false);
                  handleSubmit();
                }}
              >
                Confirm Donation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonationPanel;
