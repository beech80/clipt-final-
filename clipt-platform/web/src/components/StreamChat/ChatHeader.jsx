import React from 'react';
import { motion } from 'framer-motion';
import './ChatHeader.scss';

const ChatHeader = ({
  channelInfo,
  isConnected,
  viewerCount,
  onMinimize,
  onToggleSettings,
  onToggleEmotes,
  onToggleDonate,
  onToggleModPanel,
  isModerator
}) => {
  // Connection status indicator
  const connectionStatus = isConnected 
    ? { label: 'Connected', color: 'green', icon: 'circle' }
    : { label: 'Connecting...', color: 'orange', icon: 'circle-notch fa-spin' };
    
  // Format viewer count
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <header className="chat-header">
      <div className="chat-header__left">
        <div className="chat-header__status">
          <i 
            className={`fas fa-${connectionStatus.icon}`} 
            style={{ color: connectionStatus.color }}
            title={connectionStatus.label}
          />
        </div>
        
        <div className="chat-header__info">
          {channelInfo ? (
            <>
              <h3 className="chat-header__title">{channelInfo.displayName || channelInfo.username}</h3>
              <div className="chat-header__meta">
                <span className="chat-header__viewers">
                  <i className="fas fa-user" /> {formatNumber(viewerCount)}
                </span>
              </div>
            </>
          ) : (
            <h3 className="chat-header__title">Chat</h3>
          )}
        </div>
      </div>
      
      <div className="chat-header__right">
        {channelInfo && (
          <>
            <motion.button
              className="chat-header__button"
              onClick={onToggleDonate}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title="Donate"
            >
              <i className="fas fa-coins" />
            </motion.button>
            
            <motion.button
              className="chat-header__button"
              onClick={onToggleEmotes}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title="Emotes"
            >
              <i className="fas fa-smile" />
            </motion.button>
            
            {isModerator && (
              <motion.button
                className="chat-header__button chat-header__button--mod"
                onClick={onToggleModPanel}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="Moderator Panel"
              >
                <i className="fas fa-shield-alt" />
              </motion.button>
            )}
          </>
        )}
        
        <motion.button
          className="chat-header__button"
          onClick={onToggleSettings}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="Chat Settings"
        >
          <i className="fas fa-cog" />
        </motion.button>
        
        <motion.button
          className="chat-header__button"
          onClick={onMinimize}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="Minimize Chat"
        >
          <i className="fas fa-compress-alt" />
        </motion.button>
      </div>
    </header>
  );
};

export default ChatHeader;
