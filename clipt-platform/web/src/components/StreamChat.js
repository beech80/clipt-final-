import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import './StreamChat.css';

// Components
import EmotePicker from './EmotePicker';
import ChatMessage from './ChatMessage';
import DonationPanel from './DonationPanel';
import ChatHeader from './ChatHeader';
import VirtualizedMessageList from './VirtualizedMessageList';

/**
 * Advanced Stream Chat Component
 * Features:
 * - Real-time messaging with socket.io
 * - Emote integration and parsing
 * - Virtual scrolling for performance
 * - Donation integration
 * - User badges and styles based on subscription tier
 * - Moderation tools
 * - Chat modes (subscriber-only, slow mode, etc)
 */
const StreamChat = ({ 
  channelId, 
  isModerator = false, 
  showHeader = true,
  showDonations = true,
  height = "100%"
}) => {
  // Auth context for user data
  const { user, isAuthenticated } = useAuth();
  
  // Chat state
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [showDonationPanel, setShowDonationPanel] = useState(false);
  const [chatMode, setChatMode] = useState('normal'); // normal, slow, subscribers, emote-only, followers
  const [channelInfo, setChannelInfo] = useState(null);
  const [slowModeDelay, setSlowModeDelay] = useState(0);
  const [nextMessageTime, setNextMessageTime] = useState(0);
  const [userList, setUserList] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  
  // Refs
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);
  
  // Connect to chat server
  useEffect(() => {
    if (!channelId) return;
    
    const socketUrl = process.env.REACT_APP_CHAT_URL || 'http://localhost:5000';
    
    // Create socket connection with auth
    const newSocket = io(socketUrl, {
      auth: {
        token: localStorage.getItem('clipt_token')
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });
    
    // Socket event handlers
    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
      
      // Join the channel's chat room
      newSocket.emit('joinRoom', channelId);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });
    
    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      displayError(error.message || 'Connection error');
    });
    
    newSocket.on('chatHistory', (history) => {
      setMessages(history);
    });
    
    newSocket.on('chatMessage', (message) => {
      setMessages(prev => [...prev, message]);
    });
    
    newSocket.on('donation', (donation) => {
      // Add donation message to chat
      setMessages(prev => [...prev, donation]);
      
      // Play donation animation/sound
      playDonationEffect(donation);
    });
    
    newSocket.on('userJoined', (userData) => {
      // Add user to user list
      setUserList(prev => {
        if (prev.find(u => u.username === userData.username)) {
          return prev;
        }
        return [...prev, userData];
      });
      
      // Optionally add system message about user joining
      if (channelInfo && channelInfo.showJoinMessages) {
        const joinMessage = {
          id: `system-${Date.now()}`,
          type: 'system',
          content: `${userData.username} joined the chat`,
          createdAt: new Date()
        };
        setMessages(prev => [...prev, joinMessage]);
      }
    });
    
    newSocket.on('userLeft', (userData) => {
      // Remove user from user list
      setUserList(prev => prev.filter(u => u.username !== userData.username));
      
      // Optionally add system message about user leaving
      if (channelInfo && channelInfo.showLeaveMessages) {
        const leaveMessage = {
          id: `system-${Date.now()}`,
          type: 'system',
          content: `${userData.username} left the chat`,
          createdAt: new Date()
        };
        setMessages(prev => [...prev, leaveMessage]);
      }
    });
    
    newSocket.on('roomState', (state) => {
      setChatMode(state.mode);
      setSlowModeDelay(state.slowModeDelay || 0);
      setChannelInfo(state.channelInfo);
    });
    
    newSocket.on('timeout', (data) => {
      displayError(`You have been timed out for ${data.duration} seconds: ${data.reason}`);
    });
    
    newSocket.on('banned', (data) => {
      displayError(`You have been banned from this chat: ${data.reason}`);
    });
    
    newSocket.on('moderation', (data) => {
      // Add moderation message to chat
      const modMessage = {
        id: `mod-${Date.now()}`,
        type: 'moderation',
        content: getModerationMessage(data),
        createdAt: new Date()
      };
      setMessages(prev => [...prev, modMessage]);
    });
    
    setSocket(newSocket);
    
    // Cleanup on unmount
    return () => {
      if (newSocket) {
        newSocket.off('connect');
        newSocket.off('disconnect');
        newSocket.off('error');
        newSocket.off('chatHistory');
        newSocket.off('chatMessage');
        newSocket.off('donation');
        newSocket.off('userJoined');
        newSocket.off('userLeft');
        newSocket.off('roomState');
        newSocket.off('timeout');
        newSocket.off('banned');
        newSocket.off('moderation');
        
        newSocket.emit('leaveRoom', channelId);
        newSocket.disconnect();
      }
    };
  }, [channelId]);
  
  // Handle auto scroll to bottom for new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = chatContainerRef.current;
      const isScrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;
      
      if (isScrolledToBottom) {
        chatContainerRef.current.scrollTop = scrollHeight;
      }
    }
  }, [messages]);
  
  // Send message handler
  const sendMessage = useCallback(() => {
    if (!socket || !connected || !input.trim() || isSubmitting) return;
    
    // Check if user is in timeout
    const now = Date.now();
    if (now < nextMessageTime) {
      const secondsLeft = Math.ceil((nextMessageTime - now) / 1000);
      displayError(`You can send another message in ${secondsLeft} seconds`);
      return;
    }
    
    // Check if chat is in subscriber-only mode
    if (chatMode === 'subscribers' && user.tier === 'free') {
      displayError('Chat is in subscriber-only mode');
      return;
    }
    
    // Check if chat is in followers-only mode
    if (chatMode === 'followers' && !user.isFollowing) {
      displayError('Chat is in followers-only mode');
      return;
    }
    
    // Check if chat is in emote-only mode
    if (chatMode === 'emote-only' && !containsOnlyEmotes(input)) {
      displayError('Chat is in emote-only mode');
      return;
    }
    
    setIsSubmitting(true);
    
    // Send message to server
    socket.emit('chatMessage', {
      roomId: channelId,
      content: input,
      type: 'text'
    });
    
    // Clear input
    setInput('');
    
    // Update next message time for slow mode
    if (chatMode === 'slow' && slowModeDelay > 0) {
      setNextMessageTime(now + (slowModeDelay * 1000));
    }
    
    setIsSubmitting(false);
    
    // Focus on input after sending
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [socket, connected, input, isSubmitting, channelId, nextMessageTime, chatMode, slowModeDelay, user]);
  
  // Handle input change
  const handleInputChange = (e) => {
    setInput(e.target.value);
    
    // Handle typing indicator
    if (!isTyping) {
      setIsTyping(true);
      if (socket) {
        socket.emit('typing', { roomId: channelId });
      }
    }
    
    // Clear previous timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    
    // Set new timeout to stop typing indicator
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      if (socket) {
        socket.emit('stoppedTyping', { roomId: channelId });
      }
    }, 2000);
  };
  
  // Handle key press for sending messages
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // Handle emote selection
  const handleEmoteSelect = (emote) => {
    setInput(prev => `${prev} ${emote.code} `);
    inputRef.current.focus();
  };
  
  // Donation handler
  const handleDonation = (amount, message) => {
    if (!socket || !connected || !isAuthenticated) return;
    
    socket.emit('donation', {
      roomId: channelId,
      amount,
      message
    });
    
    // Close donation panel
    setShowDonationPanel(false);
  };
  
  // Timeout user (moderation)
  const handleTimeoutUser = (username, duration = 600, reason = '') => {
    if (!socket || !connected || !isModerator) return;
    
    socket.emit('timeout', {
      roomId: channelId,
      username,
      duration,
      reason
    });
  };
  
  // Ban user (moderation)
  const handleBanUser = (username, reason = '') => {
    if (!socket || !connected || !isModerator) return;
    
    socket.emit('ban', {
      roomId: channelId,
      username,
      reason
    });
  };
  
  // Clear chat (moderation)
  const handleClearChat = () => {
    if (!socket || !connected || !isModerator) return;
    
    socket.emit('clearChat', {
      roomId: channelId
    });
    
    // Clear local messages
    setMessages([]);
  };
  
  // Change chat mode (moderation)
  const handleChangeChatMode = (mode, duration = 0) => {
    if (!socket || !connected || !isModerator) return;
    
    socket.emit('setChatMode', {
      roomId: channelId,
      mode,
      duration
    });
  };
  
  // Display error message
  const displayError = (message) => {
    setErrorMessage(message);
    setShowErrorMessage(true);
    
    // Hide error after 5 seconds
    setTimeout(() => {
      setShowErrorMessage(false);
    }, 5000);
  };
  
  // Check if a message contains only emotes
  const containsOnlyEmotes = (message) => {
    // This would check against known emote patterns
    // Simplified implementation
    return message.trim().startsWith(':') && message.trim().endsWith(':');
  };
  
  // Play donation effect
  const playDonationEffect = (donation) => {
    // Logic to play donation animation/sound
    console.log('Playing donation effect for:', donation);
    // In a real implementation, this would trigger animations/sounds
  };
  
  // Format moderation message
  const getModerationMessage = (data) => {
    switch (data.type) {
      case 'timeout':
        return `${data.username} has been timed out for ${data.duration} seconds by ${data.moderator}`;
      case 'ban':
        return `${data.username} has been banned by ${data.moderator}`;
      case 'clear':
        return `Chat has been cleared by ${data.moderator}`;
      case 'mode':
        return `Chat mode changed to ${data.mode} by ${data.moderator}`;
      default:
        return '';
    }
  };
  
  return (
    <div className="stream-chat" style={{ height }}>
      {/* Chat header with info and settings */}
      {showHeader && (
        <ChatHeader 
          channelInfo={channelInfo}
          chatMode={chatMode}
          userCount={userList.length}
          isModerator={isModerator}
          onChangeChatMode={handleChangeChatMode}
          onClearChat={handleClearChat}
        />
      )}
      
      {/* Main chat container */}
      <div className="chat-messages-container" ref={chatContainerRef}>
        <VirtualizedMessageList
          messages={messages}
          currentUser={user}
          isModerator={isModerator}
          onTimeoutUser={handleTimeoutUser}
          onBanUser={handleBanUser}
        />
      </div>
      
      {/* Error message */}
      <AnimatePresence>
        {showErrorMessage && (
          <motion.div 
            className="chat-error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Donation panel */}
      {showDonations && showDonationPanel && (
        <DonationPanel 
          onDonate={handleDonation}
          onClose={() => setShowDonationPanel(false)}
          user={user}
        />
      )}
      
      {/* Emote picker */}
      {showEmotePicker && (
        <EmotePicker 
          onSelectEmote={handleEmoteSelect}
          onClose={() => setShowEmotePicker(false)}
          userTier={user?.tier || 'free'}
        />
      )}
      
      {/* Chat input area */}
      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={
              chatMode === 'subscribers' && user.tier === 'free'
                ? 'Subscriber-only mode'
                : chatMode === 'emote-only'
                ? 'Emote-only mode'
                : chatMode === 'slow'
                ? `Slow mode (${slowModeDelay}s)`
                : 'Send a message...'
            }
            disabled={
              !connected || 
              (chatMode === 'subscribers' && user.tier === 'free') ||
              (chatMode === 'followers' && !user.isFollowing)
            }
          />
          
          <div className="chat-controls">
            <button 
              className="emote-picker-button"
              onClick={() => setShowEmotePicker(!showEmotePicker)}
              title="Emote Picker"
            >
              <span role="img" aria-label="Emote">😀</span>
            </button>
            
            {showDonations && (
              <button 
                className="donation-button"
                onClick={() => setShowDonationPanel(!showDonationPanel)}
                title="Donate"
              >
                <span role="img" aria-label="Donate">💰</span>
              </button>
            )}
            
            <button 
              className="send-button"
              onClick={sendMessage}
              disabled={
                !connected || 
                !input.trim() || 
                isSubmitting ||
                (chatMode === 'subscribers' && user.tier === 'free') ||
                (chatMode === 'followers' && !user.isFollowing)
              }
            >
              <span role="img" aria-label="Send">📤</span>
            </button>
          </div>
        </div>
        
        {/* Typing indicator or slow mode countdown */}
        <div className="chat-status">
          {Date.now() < nextMessageTime && (
            <div className="slow-mode-timer">
              Can send in {Math.ceil((nextMessageTime - Date.now()) / 1000)}s
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StreamChat;
