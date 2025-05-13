import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Textarea from 'react-textarea-autosize';
import { motion, AnimatePresence } from 'framer-motion';
import emoteService from '../../services/emoteService';
import './ChatInput.scss';

const MAX_MESSAGE_LENGTH = 500;

const ChatInput = ({
  onSendMessage,
  isConnected,
  isAuthenticated,
  availableEmotes = [],
  onToggleEmotes,
  theme = 'dark',
  disabled = false
}) => {
  const [message, setMessage] = useState('');
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [emoteSearch, setEmoteSearch] = useState('');
  const [filteredEmotes, setFilteredEmotes] = useState([]);
  const [recentEmotes, setRecentEmotes] = useState([]);
  const [emojiPickerTab, setEmojiPickerTab] = useState('recent');
  const [isSearching, setIsSearching] = useState(false);
  const [messageHistory, setMessageHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [emoteMenuPosition, setEmoteMenuPosition] = useState({ top: 0, left: 0 });
  const [showCommands, setShowCommands] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  
  const inputRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const mentionMenuRef = useRef(null);
  const currentUser = useSelector(state => state.auth.user);
  
  const commands = [
    { name: 'me', description: 'Send a message in action format (/me is dancing)', example: '/me [message]' },
    { name: 'clear', description: 'Clear your chat window (only visible to you)', example: '/clear' },
    { name: 'color', description: 'Change your username color', example: '/color #HEXCODE' },
    { name: 'block', description: 'Block a user from your chat', example: '/block [username]' },
    { name: 'unblock', description: 'Unblock a previously blocked user', example: '/unblock [username]' },
    { name: 'whisper', description: 'Send a private message to a user', example: '/whisper [username] [message]' },
    { name: 'help', description: 'Show available commands', example: '/help' }
  ];
  
  if (isAuthenticated && currentUser?.isModerator) {
    commands.push(
      { name: 'ban', description: 'Ban a user from the channel', example: '/ban [username] [reason]' },
      { name: 'unban', description: 'Unban a user from the channel', example: '/unban [username]' },
      { name: 'timeout', description: 'Timeout a user for a specified time', example: '/timeout [username] [seconds] [reason]' },
      { name: 'slow', description: 'Set slow mode with seconds between messages', example: '/slow [seconds]' },
      { name: 'slowoff', description: 'Turn off slow mode', example: '/slowoff' },
      { name: 'followers', description: 'Set followers-only mode with optional time', example: '/followers [minutes]' },
      { name: 'followersoff', description: 'Turn off followers-only mode', example: '/followersoff' },
      { name: 'mod', description: 'Make a user a moderator', example: '/mod [username]' },
      { name: 'unmod', description: 'Remove moderator status from a user', example: '/unmod [username]' }
    );
  }
  
  // Filter emotes based on search
  useEffect(() => {
    if (emoteSearch) {
      const searchLower = emoteSearch.toLowerCase();
      const filtered = availableEmotes.filter(emote => 
        emote.code.toLowerCase().includes(searchLower) || 
        emote.name.toLowerCase().includes(searchLower)
      );
      setFilteredEmotes(filtered);
      setIsSearching(true);
    } else {
      setFilteredEmotes(availableEmotes);
      setIsSearching(false);
    }
  }, [emoteSearch, availableEmotes]);
  
  // Get recent emotes
  useEffect(() => {
    const recent = emoteService.getRecentEmotes();
    setRecentEmotes(recent);
  }, []);
  
  // Handle command completion
  useEffect(() => {
    if (message.startsWith('/') && !message.includes(' ')) {
      const search = message.slice(1).toLowerCase();
      setCommandFilter(search);
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }
  }, [message]);
  
  // Handle @ mentions
  useEffect(() => {
    if (mentionSearch) {
      // In a real app, we'd fetch users from API
      // For now, we'll just mock some results
      const mockResults = [
        { id: '1', username: 'alice', displayName: 'Alice', avatar: '/assets/avatars/default.png' },
        { id: '2', username: 'bob', displayName: 'Bob', avatar: '/assets/avatars/default.png' },
        { id: '3', username: 'charlie', displayName: 'Charlie', avatar: '/assets/avatars/default.png' },
        { id: '4', username: 'dana', displayName: 'Dana', avatar: '/assets/avatars/default.png' },
        { id: '5', username: 'evan', displayName: 'Evan', avatar: '/assets/avatars/default.png' },
      ];
      
      const searchLower = mentionSearch.toLowerCase();
      const filtered = mockResults.filter(user => 
        user.username.toLowerCase().includes(searchLower) || 
        user.displayName.toLowerCase().includes(searchLower)
      );
      
      setMentionResults(filtered);
    }
  }, [mentionSearch]);
  
  // Add click event listener to close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current && 
        !emojiPickerRef.current.contains(event.target) &&
        emojiButtonRef.current && 
        !emojiButtonRef.current.contains(event.target)
      ) {
        setShowEmotePicker(false);
      }
      
      if (
        mentionMenuRef.current && 
        !mentionMenuRef.current.contains(event.target)
      ) {
        setShowMentions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Position the mention menu
  useEffect(() => {
    if (showMentions && inputRef.current) {
      const textarea = inputRef.current;
      const cursorPosition = textarea.selectionStart;
      
      // Calculate position based on the @ character
      const textBeforeCursor = message.substring(0, cursorPosition);
      const lines = textBeforeCursor.split('\n');
      const currentLineIndex = lines.length - 1;
      const currentLine = lines[currentLineIndex];
      
      // Find the position of @ in the current line
      const atIndex = currentLine.lastIndexOf('@');
      if (atIndex !== -1) {
        // Use the scroll position and line height to position the menu
        const lineHeight = 20; // Approximate line height
        const top = (currentLineIndex * lineHeight) - textarea.scrollTop + 30;
        
        // Calculate the left position based on the characters before @
        const charsBeforeAt = currentLine.substring(0, atIndex).length;
        const charWidth = 8; // Approximate character width
        const left = charsBeforeAt * charWidth;
        
        setMentionPosition({ top, left });
      }
    }
  }, [showMentions, message]);
  
  // Position the emote menu
  useEffect(() => {
    if (showEmotePicker && emojiButtonRef.current) {
      const rect = emojiButtonRef.current.getBoundingClientRect();
      setEmoteMenuPosition({
        top: -320, // Position above the input
        left: rect.left - 160 // Center with the button
      });
    }
  }, [showEmotePicker]);
  
  // Handle message input
  const handleInputChange = (e) => {
    const newMessage = e.target.value;
    
    // Check for @ mentions
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newMessage.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1 && textBeforeCursor.substring(atIndex).length > 1) {
      // There's an @ character and at least one character after it
      const lastSpace = textBeforeCursor.lastIndexOf(' ', atIndex - 1);
      const isStartOfLineOrAfterSpace = atIndex === 0 || lastSpace === atIndex - 1 || textBeforeCursor[atIndex - 1] === '\n';
      
      if (isStartOfLineOrAfterSpace) {
        // Extract the search term after @
        const searchTerm = textBeforeCursor.substring(atIndex + 1);
        setMentionSearch(searchTerm);
        setShowMentions(true);
        setMentionStartIndex(atIndex);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
    
    setMessage(newMessage);
  };
  
  // Handle message submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim() || !isConnected || !isAuthenticated || disabled) {
      return;
    }
    
    // Check message length
    if (message.length > MAX_MESSAGE_LENGTH) {
      // Truncate message
      const truncated = message.substring(0, MAX_MESSAGE_LENGTH);
      onSendMessage(truncated);
    } else {
      onSendMessage(message);
    }
    
    // Add to message history
    if (message.trim()) {
      setMessageHistory(prev => [message, ...prev.slice(0, 49)]);
    }
    
    // Reset input and history index
    setMessage('');
    setHistoryIndex(-1);
  };
  
  // Handle key events
  const handleKeyDown = (e) => {
    // Message history navigation
    if (e.key === 'ArrowUp' && message === '' && messageHistory.length > 0) {
      e.preventDefault();
      const newIndex = historyIndex < messageHistory.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      setMessage(messageHistory[newIndex] || '');
    } else if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault();
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setMessage(newIndex >= 0 ? messageHistory[newIndex] : '');
    }
    
    // Tab completion for commands
    if (e.key === 'Tab' && showCommands) {
      e.preventDefault();
      const filtered = commands.filter(cmd => 
        cmd.name.toLowerCase().startsWith(commandFilter.toLowerCase())
      );
      
      if (filtered.length > 0) {
        setMessage(`/${filtered[0].name} `);
      }
    }
    
    // Submit on Enter (unless Shift is pressed for newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // Handle mention selection with Enter
      if (showMentions && mentionResults.length > 0) {
        handleMentionSelect(mentionResults[0]);
        return;
      }
      
      handleSubmit(e);
    }
    
    // Close emoji picker with Escape
    if (e.key === 'Escape') {
      setShowEmotePicker(false);
      setShowMentions(false);
    }
  };
  
  // Handle emoji selection
  const handleEmoteSelect = (emote) => {
    // Insert the emote code at the current cursor position
    if (inputRef.current) {
      const cursorPosition = inputRef.current.selectionStart;
      const textBefore = message.substring(0, cursorPosition);
      const textAfter = message.substring(cursorPosition);
      
      setMessage(`${textBefore}${emote.code}${textAfter}`);
      
      // Add to recent emotes
      emoteService.addRecentEmote(emote);
      setRecentEmotes(emoteService.getRecentEmotes());
      
      // Focus back on input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(
            cursorPosition + emote.code.length,
            cursorPosition + emote.code.length
          );
        }
      }, 0);
    }
  };
  
  // Handle command selection
  const handleCommandSelect = (command) => {
    setMessage(`/${command.name} `);
    setShowCommands(false);
    
    // Focus and place cursor at the end
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const length = `/${command.name} `.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }, 0);
  };
  
  // Handle mention selection
  const handleMentionSelect = (user) => {
    if (mentionStartIndex !== -1) {
      const before = message.substring(0, mentionStartIndex);
      const after = message.substring(inputRef.current.selectionStart);
      
      // Replace @search with @username
      setMessage(`${before}@${user.username} ${after}`);
      
      // Close mention menu and reset state
      setShowMentions(false);
      setMentionSearch('');
      
      // Focus and place cursor after the inserted mention
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const cursorPos = mentionStartIndex + user.username.length + 2; // +2 for @ and space
          inputRef.current.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    }
  };
  
  // Emoji picker tabs
  const renderEmojiPickerTabs = () => {
    const tabs = [
      { id: 'recent', label: 'Recent', icon: 'fas fa-history' },
      { id: 'all', label: 'All', icon: 'fas fa-smile' },
      { id: 'custom', label: 'Custom', icon: 'fas fa-star' },
    ];
    
    return (
      <div className="chat-input__emoji-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`chat-input__emoji-tab ${emojiPickerTab === tab.id ? 'chat-input__emoji-tab--active' : ''}`}
            onClick={() => setEmojiPickerTab(tab.id)}
            title={tab.label}
          >
            <i className={tab.icon}></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    );
  };
  
  // Render emoji groups
  const renderEmoteGroups = () => {
    if (isSearching) {
      return (
        <div className="chat-input__emoji-group">
          <h3 className="chat-input__emoji-group-title">Search Results</h3>
          <div className="chat-input__emoji-list">
            {filteredEmotes.length > 0 ? (
              filteredEmotes.map(emote => (
                <button
                  key={emote.id}
                  className="chat-input__emoji-btn"
                  onClick={() => handleEmoteSelect(emote)}
                  title={emote.code}
                >
                  <img 
                    src={emote.url} 
                    alt={emote.code} 
                    className={emote.isAnimated ? 'chat-input__emoji-img chat-input__emoji-img--animated' : 'chat-input__emoji-img'} 
                  />
                </button>
              ))
            ) : (
              <div className="chat-input__emoji-empty">No emotes found</div>
            )}
          </div>
        </div>
      );
    }
    
    if (emojiPickerTab === 'recent') {
      return (
        <div className="chat-input__emoji-group">
          <h3 className="chat-input__emoji-group-title">Recently Used</h3>
          <div className="chat-input__emoji-list">
            {recentEmotes.length > 0 ? (
              recentEmotes.map(emote => (
                <button
                  key={emote.id}
                  className="chat-input__emoji-btn"
                  onClick={() => handleEmoteSelect(emote)}
                  title={emote.code}
                >
                  <img 
                    src={emote.url} 
                    alt={emote.code} 
                    className={emote.isAnimated ? 'chat-input__emoji-img chat-input__emoji-img--animated' : 'chat-input__emoji-img'} 
                  />
                </button>
              ))
            ) : (
              <div className="chat-input__emoji-empty">No recent emotes</div>
            )}
          </div>
        </div>
      );
    }
    
    if (emojiPickerTab === 'all') {
      return (
        <div className="chat-input__emoji-group">
          <h3 className="chat-input__emoji-group-title">All Emotes</h3>
          <div className="chat-input__emoji-list">
            {availableEmotes.length > 0 ? (
              availableEmotes.map(emote => (
                <button
                  key={emote.id}
                  className="chat-input__emoji-btn"
                  onClick={() => handleEmoteSelect(emote)}
                  title={emote.code}
                >
                  <img 
                    src={emote.url} 
                    alt={emote.code} 
                    className={emote.isAnimated ? 'chat-input__emoji-img chat-input__emoji-img--animated' : 'chat-input__emoji-img'} 
                  />
                </button>
              ))
            ) : (
              <div className="chat-input__emoji-empty">No emotes available</div>
            )}
          </div>
        </div>
      );
    }
    
    if (emojiPickerTab === 'custom') {
      // Filter only custom emotes (non-global)
      const customEmotes = availableEmotes.filter(emote => emote.type !== 'global');
      
      return (
        <div className="chat-input__emoji-group">
          <h3 className="chat-input__emoji-group-title">Custom Emotes</h3>
          <div className="chat-input__emoji-list">
            {customEmotes.length > 0 ? (
              customEmotes.map(emote => (
                <button
                  key={emote.id}
                  className="chat-input__emoji-btn"
                  onClick={() => handleEmoteSelect(emote)}
                  title={emote.code}
                >
                  <img 
                    src={emote.url} 
                    alt={emote.code} 
                    className={emote.isAnimated ? 'chat-input__emoji-img chat-input__emoji-img--animated' : 'chat-input__emoji-img'} 
                  />
                </button>
              ))
            ) : (
              <div className="chat-input__emoji-empty">No custom emotes available</div>
            )}
          </div>
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className={`chat-input chat-input--${theme}`}>
      {!isAuthenticated ? (
        <div className="chat-input__login-prompt">
          <p>You must be logged in to chat</p>
          <a href="/login" className="chat-input__login-btn">Log In</a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="chat-input__form">
          <div className="chat-input__container">
            <Textarea
              ref={inputRef}
              className="chat-input__textarea"
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? "Send a message..." : "Connecting..."}
              disabled={!isConnected || disabled}
              maxRows={5}
              maxLength={MAX_MESSAGE_LENGTH + 50} // Add some buffer
            />
            
            <div className="chat-input__controls">
              <button
                type="button"
                ref={emojiButtonRef}
                className="chat-input__emoji-toggle"
                onClick={() => setShowEmotePicker(!showEmotePicker)}
                disabled={!isConnected || disabled}
                title="Emotes"
              >
                <i className="far fa-smile"></i>
              </button>
              
              <button
                type="button"
                className="chat-input__panel-toggle"
                onClick={onToggleEmotes}
                disabled={!isConnected || disabled}
                title="Emote Panel"
              >
                <i className="fas fa-stream"></i>
              </button>
              
              <button
                type="submit"
                className="chat-input__submit"
                disabled={!message.trim() || !isConnected || disabled}
                title="Send"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
            
            {message.length > 0 && (
              <div className="chat-input__counter">
                <span className={message.length > MAX_MESSAGE_LENGTH ? 'chat-input__counter--limit' : ''}>
                  {message.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
            )}
          </div>
          
          <AnimatePresence>
            {showEmotePicker && (
              <motion.div
                ref={emojiPickerRef}
                className="chat-input__emoji-picker"
                style={{
                  top: `${emoteMenuPosition.top}px`,
                  left: `${emoteMenuPosition.left}px`
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="chat-input__emoji-header">
                  <div className="chat-input__emoji-search">
                    <input
                      type="text"
                      placeholder="Search emotes..."
                      value={emoteSearch}
                      onChange={(e) => setEmoteSearch(e.target.value)}
                      className="chat-input__emoji-search-input"
                    />
                    {emoteSearch && (
                      <button
                        className="chat-input__emoji-search-clear"
                        onClick={() => setEmoteSearch('')}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                  </div>
                  {!isSearching && renderEmojiPickerTabs()}
                </div>
                
                <div className="chat-input__emoji-content">
                  {renderEmoteGroups()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {showCommands && (
              <motion.div
                className="chat-input__commands"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="chat-input__commands-list">
                  {commands
                    .filter(cmd => cmd.name.toLowerCase().startsWith(commandFilter.toLowerCase()))
                    .slice(0, 5)
                    .map(command => (
                      <div
                        key={command.name}
                        className="chat-input__command-item"
                        onClick={() => handleCommandSelect(command)}
                      >
                        <div className="chat-input__command-name">/{command.name}</div>
                        <div className="chat-input__command-desc">{command.description}</div>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {showMentions && mentionResults.length > 0 && (
              <motion.div
                ref={mentionMenuRef}
                className="chat-input__mentions"
                style={{
                  top: `${mentionPosition.top}px`,
                  left: `${mentionPosition.left}px`
                }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="chat-input__mentions-list">
                  {mentionResults.slice(0, 5).map(user => (
                    <div
                      key={user.id}
                      className="chat-input__mention-item"
                      onClick={() => handleMentionSelect(user)}
                    >
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="chat-input__mention-avatar"
                      />
                      <div className="chat-input__mention-info">
                        <div className="chat-input__mention-name">{user.displayName}</div>
                        <div className="chat-input__mention-username">@{user.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      )}
    </div>
  );
};

export default ChatInput;
