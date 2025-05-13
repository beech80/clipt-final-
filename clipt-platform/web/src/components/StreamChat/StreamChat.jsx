import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import io from 'socket.io-client';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ChatHeader from './ChatHeader';
import ChatSettings from './ChatSettings';
import DonationPanel from './DonationPanel';
import EmotePanel from './EmotePanel';
import UserCard from './UserCard';
import ModPanel from './ModPanel';
import api from '../../services/api';
import emoteService from '../../services/emoteService';
import './StreamChat.scss';

const StreamChat = ({ isMinimized = false, onToggleMinimize }) => {
  const { channelId } = useParams();
  const socketRef = useRef(null);
  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentUser = useSelector((state) => state.auth.user);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmotes, setUserEmotes] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmotePanel, setShowEmotePanel] = useState(false);
  const [showDonationPanel, setShowDonationPanel] = useState(false);
  const [showModPanel, setShowModPanel] = useState(false);
  const [viewingUserCard, setViewingUserCard] = useState(null);
  const [hoveredUser, setHoveredUser] = useState(null);
  const [hoveredUserTimer, setHoveredUserTimer] = useState(null);
  const [channelInfo, setChannelInfo] = useState(null);
  const [channelModerators, setChannelModerators] = useState([]);
  const [isModerator, setIsModerator] = useState(false);
  const [chatSettings, setChatSettings] = useState({
    timestamps: true,
    animations: true,
    sounds: true,
    coloredNames: true,
    fontSize: 'medium',
    theme: 'dark'
  });
  
  // Message handlers
  const addMessage = useCallback((message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  }, []);
  
  const handleNewDonation = useCallback((donation) => {
    // Create a special donation message
    const donationMessage = {
      ...donation,
      type: 'donation',
      id: `donation_${donation.id}`,
      timestamp: donation.timestamp || new Date().toISOString()
    };
    
    addMessage(donationMessage);
    
    // Play donation sound if settings allow
    if (chatSettings.sounds) {
      const audio = new Audio('/assets/sounds/donation.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.error('Failed to play donation sound:', e));
    }
  }, [addMessage, chatSettings.sounds]);
  
  const handleSystemMessage = useCallback((data) => {
    const systemMessage = {
      id: `system_${Date.now()}`,
      content: data.content,
      type: 'system',
      timestamp: new Date().toISOString(),
      style: data.style || 'info'
    };
    
    addMessage(systemMessage);
  }, [addMessage]);
  
  const handleUserTimeout = useCallback((data) => {
    // If the timed-out user is the current user, show a toast notification
    if (currentUser && data.userId === currentUser.id) {
      toast.warning(`You have been timed out for ${data.duration} seconds: ${data.reason || 'No reason provided'}`);
    }
    
    // Also add a system message to the chat
    const systemMessage = {
      id: `timeout_${Date.now()}`,
      content: `${data.username} has been timed out for ${data.duration} seconds${data.reason ? `: ${data.reason}` : ''}.`,
      type: 'system',
      timestamp: new Date().toISOString(),
      style: 'warning'
    };
    
    addMessage(systemMessage);
  }, [addMessage, currentUser]);
  
  const handleUserBan = useCallback((data) => {
    // If the banned user is the current user, show a toast notification
    if (currentUser && data.userId === currentUser.id) {
      toast.error(`You have been banned from this channel: ${data.reason || 'No reason provided'}`);
    }
    
    // Also add a system message to the chat
    const systemMessage = {
      id: `ban_${Date.now()}`,
      content: `${data.username} has been banned${data.reason ? `: ${data.reason}` : ''}.`,
      type: 'system',
      timestamp: new Date().toISOString(),
      style: 'error'
    };
    
    addMessage(systemMessage);
  }, [addMessage, currentUser]);
  
  const handleChatCleared = useCallback(() => {
    setMessages([]);
    handleSystemMessage({ content: 'The chat has been cleared by a moderator.' });
  }, [handleSystemMessage]);
  
  // Initialize chat
  useEffect(() => {
    if (!channelId) return;
    
    const initializeChat = async () => {
      setIsLoading(true);
      
      try {
        // Get channel info
        const channelResponse = await api.get(`/channels/${channelId}`);
        setChannelInfo(channelResponse.data);
        
        // Get channel moderators
        const modResponse = await api.get(`/api/chat/moderators/${channelId}`);
        setChannelModerators(modResponse.data);
        
        // Check if current user is a moderator
        if (currentUser) {
          const isMod = modResponse.data.some(mod => mod.userId === currentUser.id) || 
                        (channelResponse.data.ownerId === currentUser.id);
          setIsModerator(isMod);
        }
        
        // Load previous messages
        const messagesResponse = await api.get(`/api/chat/messages/${channelId}?limit=50`);
        setMessages(messagesResponse.data);
        
        // Load emotes
        const userTier = currentUser?.subscriptionTier || 'free';
        const emotes = await emoteService.getAllEmotes({ 
          channelId, 
          tier: userTier 
        });
        setUserEmotes(emotes);
        
        // Connect to socket
        connectToSocket();
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing chat:', error);
        toast.error('Failed to load chat. Please try again later.');
        setIsLoading(false);
      }
    };
    
    initializeChat();
    
    // Clean up
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [channelId, currentUser]);
  
  // Connect to socket server
  const connectToSocket = () => {
    // Disconnect existing socket if it exists
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    // Connect to socket server
    const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001', {
      withCredentials: true,
      query: {
        channelId
      }
    });
    
    // Socket event handlers
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to chat server');
    });
    
    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from chat server');
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      toast.error('Chat connection error. Please try again later.');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      toast.error('Failed to connect to chat. Please try again later.');
    });
    
    // Chat event handlers
    socket.on('chat_message', (message) => {
      addMessage(message);
    });
    
    socket.on('donation', (donation) => {
      handleNewDonation(donation);
    });
    
    socket.on('system_message', (data) => {
      handleSystemMessage(data);
    });
    
    socket.on('user_timeout', (data) => {
      handleUserTimeout(data);
    });
    
    socket.on('user_ban', (data) => {
      handleUserBan(data);
    });
    
    socket.on('chat_cleared', () => {
      handleChatCleared();
    });
    
    // Set socket ref
    socketRef.current = socket;
  };
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);
  
  // Send a message
  const sendMessage = (content) => {
    if (!socketRef.current || !isConnected || !isAuthenticated) {
      toast.error('You must be connected to chat to send messages');
      return;
    }
    
    // Parse emotes before sending
    const { parsedContent, emotes } = emoteService.parseEmotes(content, userEmotes);
    
    // Send message to server
    socketRef.current.emit('chat_message', {
      content: parsedContent,
      emotes: emotes.map(e => e.id)
    });
  };
  
  // Send a donation
  const sendDonation = (amount, message, effects = {}) => {
    if (!socketRef.current || !isConnected || !isAuthenticated) {
      toast.error('You must be connected to chat to send donations');
      return;
    }
    
    // Parse emotes before sending
    const { parsedContent, emotes } = emoteService.parseEmotes(message, userEmotes);
    
    // Send donation to server
    socketRef.current.emit('donation', {
      amount,
      message: parsedContent,
      emotes: emotes.map(e => e.id),
      effects
    });
    
    // Close donation panel
    setShowDonationPanel(false);
  };
  
  // Handle mod actions
  const performModAction = (action, targetUserId, options = {}) => {
    if (!socketRef.current || !isConnected || !isAuthenticated || !isModerator) {
      toast.error('You must be a moderator to perform this action');
      return;
    }
    
    const modActionMap = {
      timeout: 'mod_timeout',
      ban: 'mod_ban',
      unban: 'mod_unban',
      delete: 'mod_delete',
      clear: 'mod_clear'
    };
    
    const eventName = modActionMap[action];
    if (!eventName) {
      console.error('Unknown mod action:', action);
      return;
    }
    
    // Send mod action to server
    socketRef.current.emit(eventName, {
      targetUserId,
      ...options
    });
    
    // Close user card if open
    if (viewingUserCard) {
      setViewingUserCard(null);
    }
  };
  
  // User interaction handlers
  const handleUserHover = (userId, username) => {
    if (hoveredUserTimer) {
      clearTimeout(hoveredUserTimer);
    }
    
    const timer = setTimeout(() => {
      setHoveredUser({ id: userId, username });
    }, 500); // 500ms delay to prevent flickering
    
    setHoveredUserTimer(timer);
  };
  
  const handleUserHoverEnd = () => {
    if (hoveredUserTimer) {
      clearTimeout(hoveredUserTimer);
      setHoveredUserTimer(null);
    }
    
    setHoveredUser(null);
  };
  
  const handleUserClick = async (userId) => {
    try {
      const response = await api.get(`/users/${userId}`);
      setViewingUserCard(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load user data');
    }
  };
  
  // Settings handlers
  const handleSettingsChange = (newSettings) => {
    setChatSettings({ ...chatSettings, ...newSettings });
    
    // Save settings to localStorage
    try {
      localStorage.setItem('clipt_chat_settings', JSON.stringify({
        ...chatSettings,
        ...newSettings
      }));
    } catch (error) {
      console.error('Error saving chat settings:', error);
    }
  };
  
  // Load settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('clipt_chat_settings');
      if (savedSettings) {
        setChatSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading chat settings:', error);
    }
  }, []);
  
  // Component rendering
  if (isMinimized) {
    return (
      <div className="stream-chat stream-chat--minimized">
        <button 
          className="stream-chat__expand-button"
          onClick={onToggleMinimize}
          aria-label="Expand chat"
        >
          <i className="fas fa-comments"></i>
        </button>
      </div>
    );
  }
  
  return (
    <div className={`stream-chat stream-chat--${chatSettings.theme}`}>
      <ChatHeader 
        channelInfo={channelInfo}
        isConnected={isConnected}
        viewerCount={channelInfo?.viewerCount || 0}
        onMinimize={onToggleMinimize}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onToggleEmotes={() => setShowEmotePanel(!showEmotePanel)}
        onToggleDonate={() => setShowDonationPanel(!showDonationPanel)}
        onToggleModPanel={() => isModerator && setShowModPanel(!showModPanel)}
        isModerator={isModerator}
      />
      
      <div className="stream-chat__body" ref={chatContainerRef}>
        {isLoading ? (
          <div className="stream-chat__loading">
            <div className="stream-chat__loading-spinner"></div>
            <p>Loading chat...</p>
          </div>
        ) : (
          <>
            <div className="stream-chat__messages">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  chatSettings={chatSettings}
                  currentUserId={currentUser?.id}
                  isModerator={isModerator}
                  onUserHover={handleUserHover}
                  onUserHoverEnd={handleUserHoverEnd}
                  onUserClick={handleUserClick}
                  onModAction={performModAction}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            {hoveredUser && (
              <div 
                className="stream-chat__user-hover"
                style={{ 
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)' 
                }}
              >
                <div className="stream-chat__user-hover-content">
                  <h4>{hoveredUser.username}</h4>
                  <div className="stream-chat__user-hover-actions">
                    <button onClick={() => handleUserClick(hoveredUser.id)}>
                      View Profile
                    </button>
                    {isModerator && (
                      <button onClick={() => handleUserClick(hoveredUser.id)}>
                        Mod Actions
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      <ChatInput 
        onSendMessage={sendMessage}
        isConnected={isConnected}
        isAuthenticated={isAuthenticated}
        availableEmotes={userEmotes}
        onToggleEmotes={() => setShowEmotePanel(!showEmotePanel)}
        theme={chatSettings.theme}
        disabled={isLoading}
      />
      
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="stream-chat__panel"
          >
            <ChatSettings 
              settings={chatSettings}
              onSettingsChange={handleSettingsChange}
              onClose={() => setShowSettings(false)}
            />
          </motion.div>
        )}
        
        {showEmotePanel && (
          <motion.div
            initial={{ opacity: 0, y: 300 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 300 }}
            className="stream-chat__panel"
          >
            <EmotePanel 
              emotes={userEmotes}
              onSelectEmote={(emote) => {
                // Copy to clipboard
                navigator.clipboard.writeText(emote.code)
                  .then(() => {
                    toast.success(`Copied ${emote.code} to clipboard!`);
                  })
                  .catch(err => {
                    console.error('Failed to copy emote to clipboard:', err);
                  });
              }}
              recentEmotes={emoteService.getRecentEmotes()}
              onClose={() => setShowEmotePanel(false)}
            />
          </motion.div>
        )}
        
        {showDonationPanel && (
          <motion.div
            initial={{ opacity: 0, y: 300 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 300 }}
            className="stream-chat__panel"
          >
            <DonationPanel 
              onSendDonation={sendDonation}
              availableEmotes={userEmotes}
              channelInfo={channelInfo}
              onClose={() => setShowDonationPanel(false)}
            />
          </motion.div>
        )}
        
        {showModPanel && (
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            className="stream-chat__panel"
          >
            <ModPanel 
              channelId={channelId}
              channelInfo={channelInfo}
              moderators={channelModerators}
              onModAction={performModAction}
              onClose={() => setShowModPanel(false)}
            />
          </motion.div>
        )}
        
        {viewingUserCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="stream-chat__user-card-overlay"
          >
            <UserCard 
              user={viewingUserCard}
              isModerator={isModerator}
              onModAction={performModAction}
              onClose={() => setViewingUserCard(null)}
              channelId={channelId}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StreamChat;
