import React, { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import parse from 'html-react-parser';
import linkifyHtml from 'linkify-html';
import './ChatMessage.scss';

const ChatMessage = ({
  message,
  chatSettings,
  currentUserId,
  isModerator,
  onUserHover,
  onUserHoverEnd,
  onUserClick,
  onModAction
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messageRef = useRef(null);
  
  // Check if the message is from the current user
  const isCurrentUser = message.userId === currentUserId;
  
  // Parse timestamps
  const timestamp = new Date(message.timestamp);
  const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const relativeTime = formatDistanceToNow(timestamp, { addSuffix: true });
  
  // Generate user color based on username (for non-system messages)
  const getUserColor = (username) => {
    if (!username || !chatSettings.coloredNames) return '#ffffff';
    
    // Hash the username to generate a color
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate HSL color with good saturation and lightness
    const h = Math.abs(hash) % 360;
    const s = 70 + (Math.abs(hash) % 30); // 70-100% saturation
    const l = 60 + (Math.abs(hash) % 15); // 60-75% lightness (readable on dark bg)
    
    return `hsl(${h}, ${s}%, ${l}%)`;
  };
  
  // Process emotes in message content
  const processMessageContent = () => {
    if (!message.content) return '';
    
    let processedContent = message.content;
    
    // Replace emote placeholders with actual emote images
    if (message.emotes && message.emotes.length > 0) {
      message.emotes.forEach(emote => {
        const emoteCode = emote.id;
        const emotePlaceholder = `<emote:${emoteCode}>`;
        const isAnimated = emote.isAnimated || false;
        
        // Create emote HTML
        const emoteHtml = `
          <span class="chat-message__emote ${isAnimated ? 'chat-message__emote--animated' : ''}" title="${emote.code}">
            <img src="${emote.url}" alt="${emote.code}" width="${emote.width || 28}" height="${emote.height || 28}" />
          </span>
        `;
        
        // Replace all instances of the emote placeholder
        const regex = new RegExp(emotePlaceholder, 'g');
        processedContent = processedContent.replace(regex, emoteHtml);
      });
    }
    
    // Linkify URLs
    processedContent = linkifyHtml(processedContent, {
      defaultProtocol: 'https',
      target: '_blank',
      rel: 'noopener noreferrer',
      className: 'chat-message__link'
    });
    
    // Sanitize content
    return DOMPurify.sanitize(processedContent, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'span', 'img', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'title', 'src', 'alt', 'width', 'height'],
    });
  };
  
  // Handle message actions
  const handleDelete = () => {
    if (isModerator || isCurrentUser) {
      onModAction('delete', message.id);
    }
  };
  
  const handleTimeout = (duration = 600) => {
    if (isModerator && message.userId && message.userId !== currentUserId) {
      onModAction('timeout', message.userId, { duration });
    }
  };
  
  const handleBan = () => {
    if (isModerator && message.userId && message.userId !== currentUserId) {
      onModAction('ban', message.userId);
    }
  };
  
  // Message animation variants
  const messageAnimationVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };
  
  // Handle message content rendering based on type
  const renderMessageContent = () => {
    // For system messages
    if (message.type === 'system') {
      return (
        <div className={`chat-message__system chat-message__system--${message.style || 'info'}`}>
          {parse(processMessageContent())}
        </div>
      );
    }
    
    // For donation messages
    if (message.type === 'donation') {
      return (
        <div className="chat-message__donation">
          <div className="chat-message__donation-header">
            <div 
              className="chat-message__donation-user"
              onClick={() => message.userId && onUserClick(message.userId)}
              onMouseEnter={() => message.userId && onUserHover(message.userId, message.username)}
              onMouseLeave={onUserHoverEnd}
            >
              <span className="chat-message__username" style={{ color: getUserColor(message.username) }}>
                {message.username}
              </span>
            </div>
            <div className="chat-message__donation-amount">{message.amount} tokens</div>
          </div>
          <div className="chat-message__donation-message">
            {parse(processMessageContent())}
          </div>
        </div>
      );
    }
    
    // For standard chat messages
    return (
      <>
        <div className="chat-message__header">
          {chatSettings.timestamps && (
            <span className="chat-message__timestamp" title={relativeTime}>
              {formattedTime}
            </span>
          )}
          <div 
            className="chat-message__user"
            onClick={() => message.userId && onUserClick(message.userId)}
            onMouseEnter={() => message.userId && onUserHover(message.userId, message.username)}
            onMouseLeave={onUserHoverEnd}
          >
            {message.badges && message.badges.length > 0 && (
              <span className="chat-message__badges">
                {message.badges.map((badge, index) => (
                  <img 
                    key={index}
                    src={badge.url}
                    alt={badge.name}
                    title={badge.name}
                    className="chat-message__badge"
                  />
                ))}
              </span>
            )}
            <span 
              className={`chat-message__username ${message.userType ? `chat-message__username--${message.userType}` : ''}`}
              style={{ color: getUserColor(message.username) }}
            >
              {message.username}
            </span>
          </div>
        </div>
        <div className={`chat-message__content ${message.isAction ? 'chat-message__content--action' : ''}`}>
          {parse(processMessageContent())}
        </div>
      </>
    );
  };
  
  // Apply font size from settings
  const getFontSizeClass = () => {
    const sizeMap = {
      'small': 'chat-message--small',
      'medium': 'chat-message--medium',
      'large': 'chat-message--large'
    };
    return sizeMap[chatSettings.fontSize] || 'chat-message--medium';
  };
  
  // Expand long messages
  useEffect(() => {
    if (messageRef.current) {
      const isLong = messageRef.current.scrollHeight > 100;
      if (isLong && !isExpanded) {
        messageRef.current.style.maxHeight = '100px';
      } else {
        messageRef.current.style.maxHeight = 'none';
      }
    }
  }, [isExpanded, message.content]);
  
  // Message class based on type and settings
  const getMessageClass = () => {
    let classes = [
      'chat-message',
      getFontSizeClass(),
      `chat-message--${message.type || 'standard'}`,
    ];
    
    if (isCurrentUser) classes.push('chat-message--self');
    if (message.userType) classes.push(`chat-message--${message.userType}`);
    if (message.highlighted) classes.push('chat-message--highlighted');
    
    return classes.join(' ');
  };
  
  return (
    <motion.div
      className={getMessageClass()}
      initial={chatSettings.animations ? "hidden" : "visible"}
      animate="visible"
      variants={messageAnimationVariants}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="chat-message__inner" ref={messageRef}>
        {renderMessageContent()}
        
        {messageRef.current && messageRef.current.scrollHeight > 100 && !isExpanded && (
          <div className="chat-message__expand">
            <button onClick={() => setIsExpanded(true)}>Show more</button>
          </div>
        )}
      </div>
      
      {showActions && (message.type !== 'system') && (
        <div className="chat-message__actions">
          {(isModerator || isCurrentUser) && (
            <button
              className="chat-message__action-btn"
              onClick={handleDelete}
              title="Delete message"
            >
              <i className="fas fa-trash"></i>
            </button>
          )}
          
          {isModerator && !isCurrentUser && message.userId && (
            <>
              <button
                className="chat-message__action-btn"
                onClick={() => handleTimeout(600)}
                title="Timeout for 10 minutes"
              >
                <i className="fas fa-clock"></i>
              </button>
              
              <button
                className="chat-message__action-btn"
                onClick={handleBan}
                title="Ban user"
              >
                <i className="fas fa-ban"></i>
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ChatMessage;
