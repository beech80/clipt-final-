import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * TokenReward - A popup component that shows when a user earns tokens
 * with animated effects and navigation buttons.
 */
const TokenReward = ({ 
  amount, 
  activity, 
  isVisible, 
  onClose, 
  onNavigateToProfile, 
  onNavigateToBoostShop 
}) => {
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Trigger confetti effect when popup becomes visible
  useEffect(() => {
    if (isVisible && amount > 0) {
      setShowConfetti(true);
      
      // Configure confetti based on amount earned
      const intensity = Math.min(amount / 2, 1); // Scale based on token amount
      
      confetti({
        particleCount: 100 * intensity,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#F8BF60'],
      });
      
      // For larger amounts, add a second confetti burst
      if (amount >= 5) {
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0.2, y: 0.6 }
          });
        }, 200);
        
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 0.8, y: 0.6 }
          });
        }, 400);
      }
      
      // Auto-hide confetti after animation completes
      setTimeout(() => {
        setShowConfetti(false);
      }, 2500);
    }
  }, [isVisible, amount]);
  
  // Activity messages based on the activity type
  const getActivityMessage = () => {
    switch (activity) {
      case 'post_clip':
        return 'for posting a clip!';
      case 'go_live':
        return 'for going live!';
      case 'comment_five_times':
        return 'for your comments!';
      case 'ten_likes_on_post':
        return 'for getting 10 likes!';
      case 'watch_ten_clips':
        return 'for watching clips!';
      case 'subscriber_streak':
        return 'for your subscriber streak!';
      default:
        return 'for your activity!';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          className="token-reward-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <motion.div 
            className="token-reward-popup"
            initial={{ scale: 0.5, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: 20 }}
            style={{
              backgroundColor: '#1E1E2E',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
              border: '2px solid #F8BF60',
              textAlign: 'center',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Glow effect */}
            <div 
              style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                right: '-50%',
                bottom: '-50%',
                background: 'radial-gradient(circle, rgba(248,191,96,0.2) 0%, rgba(30,30,46,0) 70%)',
                zIndex: -1,
              }}
            />
            
            {/* Coin icon */}
            <motion.div
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 360 }}
              transition={{ duration: 1, ease: "easeInOut" }}
              style={{
                fontSize: '80px',
                marginBottom: '16px',
              }}
            >
              🪙
            </motion.div>
            
            {/* Token amount */}
            <motion.h2
              initial={{ scale: 0.8 }}
              animate={{ scale: 1.2 }}
              transition={{ 
                duration: 0.5, 
                yoyo: 5, 
                ease: "easeOut" 
              }}
              style={{
                fontSize: '40px',
                color: '#F8BF60',
                marginBottom: '12px',
                fontWeight: 'bold',
              }}
            >
              +{amount} TOKENS
            </motion.h2>
            
            {/* Activity message */}
            <p style={{ fontSize: '20px', marginBottom: '32px' }}>
              {getActivityMessage()}
            </p>
            
            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
              <button
                onClick={onNavigateToProfile}
                style={{
                  backgroundColor: '#8257E5',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease',
                }}
              >
                VIEW PROFILE
              </button>
              
              <button
                onClick={onNavigateToBoostShop}
                style={{
                  backgroundColor: '#F8BF60',
                  color: '#1E1E2E',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease',
                }}
              >
                BOOST SHOP
              </button>
            </div>
            
            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
                opacity: 0.7,
              }}
            >
              ×
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

TokenReward.propTypes = {
  amount: PropTypes.number.isRequired,
  activity: PropTypes.string,
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onNavigateToProfile: PropTypes.func.isRequired,
  onNavigateToBoostShop: PropTypes.func.isRequired,
};

TokenReward.defaultProps = {
  activity: '',
};

export default TokenReward;
