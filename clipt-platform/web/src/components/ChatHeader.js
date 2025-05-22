import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './StreamChat.css';

/**
 * ChatHeader Component
 * 
 * Displays information about the channel and chat status
 * Features:
 * - Channel information display
 * - User count
 * - Chat mode indicator (slow, sub-only, etc)
 * - Moderation settings dropdown for moderators
 */
const ChatHeader = ({
  channelInfo,
  chatMode,
  userCount,
  isModerator,
  onChangeChatMode,
  onClearChat
}) => {
  // State
  const [showSettings, setShowSettings] = useState(false);
  const [showModPanel, setShowModPanel] = useState(false);
  const [slowModeTime, setSlowModeTime] = useState(30);
  
  // Refs
  const settingsRef = useRef(null);
  const modPanelRef = useRef(null);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
      
      if (modPanelRef.current && !modPanelRef.current.contains(event.target)) {
        setShowModPanel(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Get chat mode text
  const getChatModeText = () => {
    switch (chatMode) {
      case 'subscribers':
        return 'Subscribers Only';
      case 'followers':
        return 'Followers Only';
      case 'emote-only':
        return 'Emote Only';
      case 'slow':
        return `Slow Mode (${slowModeTime}s)`;
      default:
        return 'Normal';
    }
  };
  
  // Handle chat mode change
  const handleChatModeChange = (mode) => {
    let duration = 0;
    
    // For slow mode, use the specified time
    if (mode === 'slow') {
      duration = slowModeTime;
    }
    
    onChangeChatMode(mode, duration);
    setShowModPanel(false);
  };
  
  // Handle slow mode time change
  const handleSlowModeTimeChange = (e) => {
    const time = parseInt(e.target.value, 10);
    if (!isNaN(time) && time > 0) {
      setSlowModeTime(time);
    }
  };
  
  // Handle clear chat
  const handleClearChat = () => {
    onClearChat();
    setShowModPanel(false);
  };
  
  return (
    <div className="chat-header">
      {/* Channel info */}
      <div className="chat-header-title">
        {channelInfo?.displayName || 'Chat'}
      </div>
      
      {/* Chat meta info */}
      <div className="chat-header-meta">
        <div className="chat-mode">
          {getChatModeText()}
        </div>
        
        <div className="chat-user-count" style={{ marginLeft: '10px' }}>
          {userCount > 0 ? `${userCount} ${userCount === 1 ? 'user' : 'users'}` : ''}
        </div>
      </div>
      
      {/* Header actions */}
      <div className="chat-header-actions">
        {/* Settings button */}
        <div className="chat-header-settings" ref={settingsRef}>
          <button 
            className="chat-header-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Chat Settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M8 3C7.44772 3 7 3.44772 7 4C7 4.55228 7.44772 5 8 5C8.55228 5 9 4.55228 9 4C9 3.44772 8.55228 3 8 3ZM7 8C7 7.44772 7.44772 7 8 7C8.55228 7 9 7.44772 9 8C9 8.55228 8.55228 9 8 9C7.44772 9 7 8.55228 7 8ZM7 12C7 11.4477 7.44772 11 8 11C8.55228 11 9 11.4477 9 12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12Z" />
            </svg>
          </button>
          
          {/* Settings dropdown */}
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                className="chat-settings-dropdown"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  width: '200px',
                  backgroundColor: 'var(--chat-header-bg)',
                  border: '1px solid var(--chat-border)',
                  borderRadius: '4px',
                  padding: '10px 0',
                  zIndex: 100,
                  marginTop: '5px'
                }}
              >
                <div 
                  className="chat-settings-item"
                  style={{
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                  onClick={() => {
                    // Toggle chat timestamp setting
                    setShowSettings(false);
                  }}
                >
                  Show Timestamps
                </div>
                
                <div 
                  className="chat-settings-separator"
                  style={{
                    height: '1px',
                    backgroundColor: 'var(--chat-border)',
                    margin: '5px 0'
                  }}
                ></div>
                
                <div 
                  className="chat-settings-item"
                  style={{
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                  onClick={() => {
                    // Open user settings or preferences
                    setShowSettings(false);
                  }}
                >
                  User Settings
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Moderator panel button (only for moderators) */}
        {isModerator && (
          <div className="chat-header-mod" ref={modPanelRef}>
            <button 
              className="chat-header-button"
              onClick={() => setShowModPanel(!showModPanel)}
              title="Moderator Settings"
              style={showModPanel ? { color: 'var(--chat-btn-hover)' } : {}}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.6 2.5H12V1.7C12 1.3 11.7 1 11.3 1H4.7C4.3 1 4 1.3 4 1.7V2.5H2.4C1.1 2.5 0 3.6 0 4.9V6.4C0 8.2 1.2 9.7 2.9 10.1C3.5 12.3 5.5 14 8 14C10.5 14 12.5 12.3 13.1 10.1C14.8 9.7 16 8.2 16 6.4V4.9C16 3.6 14.9 2.5 13.6 2.5ZM4.7 2.5H11.3V1.7H4.7V2.5ZM8 12.5C6.1 12.5 4.6 11.1 4.1 9.2C4.4 8.8 5.2 8.4 6.5 8.4C7.5 8.4 7.8 9.2 8 9.2C8.2 9.2 8.5 8.4 9.5 8.4C10.8 8.4 11.6 8.8 11.9 9.2C11.4 11.1 9.9 12.5 8 12.5ZM14.5 6.4C14.5 7.5 13.6 8.4 12.5 8.4C12 8.4 11.6 8.2 11.2 7.9C10.7 7.5 9.5 7 8 7C6.5 7 5.3 7.5 4.8 7.9C4.4 8.2 4 8.4 3.5 8.4C2.4 8.4 1.5 7.5 1.5 6.4V4.9C1.5 4.4 1.9 4 2.4 4H13.6C14.1 4 14.5 4.4 14.5 4.9V6.4Z" />
              </svg>
            </button>
            
            {/* Moderator panel dropdown */}
            <AnimatePresence>
              {showModPanel && (
                <motion.div 
                  className="chat-mod-panel"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    width: '250px',
                    backgroundColor: 'var(--chat-header-bg)',
                    border: '1px solid var(--chat-border)',
                    borderRadius: '4px',
                    padding: '15px',
                    zIndex: 100,
                    marginTop: '5px'
                  }}
                >
                  <div className="mod-panel-title" style={{ fontWeight: '600', marginBottom: '10px' }}>
                    Moderator Controls
                  </div>
                  
                  <div className="mod-panel-section" style={{ marginBottom: '15px' }}>
                    <div className="mod-panel-section-title" style={{ fontSize: '14px', marginBottom: '8px' }}>
                      Chat Mode
                    </div>
                    
                    <div className="mod-panel-actions" style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                      <button 
                        className="mod-panel-button"
                        style={{
                          padding: '8px',
                          backgroundColor: chatMode === 'normal' ? 'var(--chat-btn-hover)' : 'var(--chat-input-bg)',
                          border: '1px solid var(--chat-border)',
                          borderRadius: '4px',
                          color: 'var(--chat-text)',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                        onClick={() => handleChatModeChange('normal')}
                      >
                        Normal
                      </button>
                      
                      <button 
                        className="mod-panel-button"
                        style={{
                          padding: '8px',
                          backgroundColor: chatMode === 'emote-only' ? 'var(--chat-btn-hover)' : 'var(--chat-input-bg)',
                          border: '1px solid var(--chat-border)',
                          borderRadius: '4px',
                          color: 'var(--chat-text)',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                        onClick={() => handleChatModeChange('emote-only')}
                      >
                        Emote Only
                      </button>
                      
                      <button 
                        className="mod-panel-button"
                        style={{
                          padding: '8px',
                          backgroundColor: chatMode === 'subscribers' ? 'var(--chat-btn-hover)' : 'var(--chat-input-bg)',
                          border: '1px solid var(--chat-border)',
                          borderRadius: '4px',
                          color: 'var(--chat-text)',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                        onClick={() => handleChatModeChange('subscribers')}
                      >
                        Subscribers Only
                      </button>
                      
                      <button 
                        className="mod-panel-button"
                        style={{
                          padding: '8px',
                          backgroundColor: chatMode === 'followers' ? 'var(--chat-btn-hover)' : 'var(--chat-input-bg)',
                          border: '1px solid var(--chat-border)',
                          borderRadius: '4px',
                          color: 'var(--chat-text)',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                        onClick={() => handleChatModeChange('followers')}
                      >
                        Followers Only
                      </button>
                    </div>
                  </div>
                  
                  {/* Slow mode settings */}
                  <div className="mod-panel-section" style={{ marginBottom: '15px' }}>
                    <div className="mod-panel-section-title" style={{ fontSize: '14px', marginBottom: '8px' }}>
                      Slow Mode
                    </div>
                    
                    <div className="mod-panel-slow-mode" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type="number"
                        min="1"
                        max="120"
                        value={slowModeTime}
                        onChange={handleSlowModeTimeChange}
                        style={{
                          width: '60px',
                          padding: '8px',
                          backgroundColor: 'var(--chat-input-bg)',
                          border: '1px solid var(--chat-border)',
                          borderRadius: '4px',
                          color: 'var(--chat-text)',
                          fontSize: '13px'
                        }}
                      />
                      
                      <span style={{ fontSize: '13px' }}>seconds</span>
                      
                      <button 
                        className="mod-panel-button"
                        style={{
                          padding: '8px',
                          backgroundColor: chatMode === 'slow' ? 'var(--chat-btn-hover)' : 'var(--chat-input-bg)',
                          border: '1px solid var(--chat-border)',
                          borderRadius: '4px',
                          color: 'var(--chat-text)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          marginLeft: 'auto'
                        }}
                        onClick={() => handleChatModeChange('slow')}
                      >
                        {chatMode === 'slow' ? 'Update' : 'Enable'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Clear chat button */}
                  <div className="mod-panel-section">
                    <button 
                      className="mod-panel-button mod-panel-clear"
                      style={{
                        padding: '8px',
                        width: '100%',
                        backgroundColor: 'var(--chat-error)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                      onClick={handleClearChat}
                    >
                      Clear Chat
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;
