import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import './StreamChat.css';

/**
 * ChatMessage component renders different types of chat messages:
 * - Regular text messages
 * - Donations with token amounts
 * - System messages
 * - Moderation actions
 * - User actions
 */
const ChatMessage = ({ 
  message, 
  currentUser, 
  isModerator,
  onTimeoutUser,
  onBanUser
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const messageRef = useRef(null);
  const menuRef = useRef(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) &&
          !messageRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);
  
  // Format timestamp
  const formatTimestamp = (dateString) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return '';
    }
  };
  
  // Handle right click on username
  const handleUsernameContextMenu = (e) => {
    e.preventDefault();
    
    // Only allow context menu for moderators
    if (!isModerator || !message.user || message.user.userId === currentUser?.userId) {
      return;
    }
    
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowUserMenu(true);
  };
  
  // Handle user menu actions
  const handleTimeoutClick = (duration) => {
    onTimeoutUser(message.user.username, duration);
    setShowUserMenu(false);
  };
  
  const handleBanClick = () => {
    onBanUser(message.user.username);
    setShowUserMenu(false);
  };
  
  // Render different message types
  const renderMessage = () => {
    switch (message.type) {
      case 'donation':
        return renderDonationMessage();
      case 'action':
        return renderActionMessage();
      case 'system':
        return renderSystemMessage();
      case 'moderation':
        return renderModerationMessage();
      default:
        return renderTextMessage();
    }
  };
  
  // Render a donation message with token amount
  const renderDonationMessage = () => {
    return (
      <motion.div 
        className="message-donation"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="donation-amount">
          🪙 {message.amount} Tokens from {message.user.username}
        </div>
        {message.message && (
          <div className="donation-message">
            {message.message}
          </div>
        )}
      </motion.div>
    );
  };
  
  // Render an action message (/me)
  const renderActionMessage = () => {
    return (
      <div className="message-action">
        <span className="chat-message-time">{formatTimestamp(message.createdAt)}</span>
        <span 
          className={`chat-message-author username-${message.user.tier}`}
          onContextMenu={handleUsernameContextMenu}
        >
          * {message.user.username}
        </span>
        {' '}
        <span className="chat-message-content">
          {renderMessageContent(message.content)}
        </span>
      </div>
    );
  };
  
  // Render a system message
  const renderSystemMessage = () => {
    return (
      <div className="message-system">
        {message.content}
      </div>
    );
  };
  
  // Render a moderation message
  const renderModerationMessage = () => {
    return (
      <div className="message-moderation">
        {message.content}
      </div>
    );
  };
  
  // Render a regular text message
  const renderTextMessage = () => {
    // Get user role for username color
    let userRole = message.user?.tier || 'free';
    if (message.user?.isAdmin) userRole = 'admin';
    else if (message.user?.isModerator) userRole = 'moderator';
    
    return (
      <>
        <span className="chat-message-time">{formatTimestamp(message.createdAt)}</span>
        
        {message.user?.badges && message.user.badges.length > 0 && (
          <span className="chat-message-badges">
            {renderBadges(message.user.badges)}
          </span>
        )}
        
        <span 
          className={`chat-message-author username-${userRole}`}
          onContextMenu={handleUsernameContextMenu}
        >
          {message.user?.username}:
        </span>
        
        <span className="chat-message-content">
          {renderMessageContent(message.content, message.parsedContent, message.emotes)}
        </span>
      </>
    );
  };
  
  // Render user badges (subscription, moderator, etc)
  const renderBadges = (badges) => {
    return badges.map((badge, index) => (
      <img 
        key={index} 
        src={getBadgeImageUrl(badge)} 
        alt={badge}
        className="chat-badge"
        title={getBadgeTitle(badge)}
      />
    ));
  };
  
  // Get badge image URL
  const getBadgeImageUrl = (badge) => {
    const badgeMap = {
      'moderator': '/images/badges/moderator.png',
      'admin': '/images/badges/admin.png',
      'verified': '/images/badges/verified.png',
      'subscriber': '/images/badges/subscriber.png',
      'pro': '/images/badges/pro.png',
      'maxed': '/images/badges/maxed.png',
      'annual': '/images/badges/annual.png',
      'founder': '/images/badges/founder.png',
      'king': '/images/badges/king_crown.png',  // For "I'm the King Now" boost
      'trending': '/images/badges/trending.png' // For "Stream Surge" boost
    };
    
    return badgeMap[badge] || '/images/badges/default.png';
  };
  
  // Get badge title for tooltip
  const getBadgeTitle = (badge) => {
    const titleMap = {
      'moderator': 'Channel Moderator',
      'admin': 'Clipt Admin',
      'verified': 'Verified User',
      'subscriber': 'Subscriber',
      'pro': 'Pro Tier Subscriber',
      'maxed': 'Maxed Tier Subscriber',
      'annual': 'Annual Tier Subscriber',
      'founder': 'Channel Founder',
      'king': 'Top 10 Streamer', // For "I'm the King Now" boost
      'trending': 'Trending Stream' // For "Stream Surge" boost
    };
    
    return titleMap[badge] || badge;
  };
  
  // Render message content with emotes
  const renderMessageContent = (content, parsedContent, emotes) => {
    // If we have parsed content with emotes, use that
    if (parsedContent && emotes && emotes.length > 0) {
      return renderContentWithEmotes(parsedContent, emotes);
    }
    
    // Otherwise just return the plain content
    return content;
  };
  
  // Render content with emotes
  const renderContentWithEmotes = (parsedContent, emotes) => {
    // Split content by emote placeholders
    const parts = parsedContent.split(/<emote:([^>]+)>/g);
    
    // Map parts to React elements
    return parts.map((part, index) => {
      // Even indices are text
      if (index % 2 === 0) {
        return part;
      }
      
      // Odd indices are emote IDs
      const emote = emotes.find(e => e.id === part);
      if (!emote) return part;
      
      return (
        <span className="chat-emote" key={`${emote.id}-${index}`}>
          <img 
            src={emote.url} 
            alt={emote.code}
            title={emote.code}
            width={emote.width || 28}
            height={emote.height || 28}
          />
        </span>
      );
    });
  };
  
  // User context menu for moderation
  const renderUserContextMenu = () => {
    if (!showUserMenu) return null;
    
    return (
      <div 
        ref={menuRef}
        className="user-context-menu"
        style={{ top: menuPosition.y, left: menuPosition.x }}
      >
        <div className="user-context-menu-item">{message.user.username}</div>
        <div className="user-context-menu-separator"></div>
        <div className="user-context-menu-item" onClick={() => handleTimeoutClick(60)}>Timeout 1m</div>
        <div className="user-context-menu-item" onClick={() => handleTimeoutClick(600)}>Timeout 10m</div>
        <div className="user-context-menu-item" onClick={() => handleTimeoutClick(3600)}>Timeout 1h</div>
        <div className="user-context-menu-separator"></div>
        <div className="user-context-menu-item destructive" onClick={handleBanClick}>Ban</div>
      </div>
    );
  };
  
  // Main render
  return (
    <div 
      ref={messageRef}
      className={`chat-message message-${message.type || 'text'}`}
    >
      {renderMessage()}
      {renderUserContextMenu()}
    </div>
  );
};

export default ChatMessage;
