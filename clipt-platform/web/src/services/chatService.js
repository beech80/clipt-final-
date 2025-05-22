/**
 * Chat Service
 * Manages Socket.io connections and chat interactions for the frontend
 */

import { io } from 'socket.io-client';
import { getToken } from './authService';

class ChatService {
  constructor() {
    this.socket = null;
    this.isConnecting = false;
    this.channelId = null;
    this.eventHandlers = {
      chatMessage: [],
      donation: [],
      userJoined: [],
      userLeft: [],
      roomState: [],
      timeout: [],
      banned: [],
      moderation: [],
      error: [],
      clearChat: [],
      userTyping: [],
      userStoppedTyping: []
    };
    this.reconnectAttempts = 0;
    this.MAX_RECONNECT_ATTEMPTS = 10;
    this.reconnectTimer = null;
    this.typingTimeout = null;
  }

  /**
   * Initialize socket connection
   * @returns {Promise<boolean>} Connection status
   */
  async initializeSocket() {
    if (this.socket && this.socket.connected) {
      console.log('Socket already connected');
      return true;
    }

    if (this.isConnecting) {
      console.log('Socket connection already in progress');
      return false;
    }

    this.isConnecting = true;

    try {
      const token = await getToken();
      
      if (!token) {
        console.error('No authentication token available');
        this.isConnecting = false;
        return false;
      }

      const socketUrl = process.env.REACT_APP_CHAT_URL || 'http://localhost:5000';
      
      this.socket = io(socketUrl, {
        auth: {
          token
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 2000
      });

      // Set up event listeners
      this.socket.on('connect', this.handleConnect.bind(this));
      this.socket.on('disconnect', this.handleDisconnect.bind(this));
      this.socket.on('error', this.handleError.bind(this));
      this.socket.on('chatMessage', this.handleChatMessage.bind(this));
      this.socket.on('donation', this.handleDonation.bind(this));
      this.socket.on('userJoined', this.handleUserJoined.bind(this));
      this.socket.on('userLeft', this.handleUserLeft.bind(this));
      this.socket.on('roomState', this.handleRoomState.bind(this));
      this.socket.on('timeout', this.handleTimeout.bind(this));
      this.socket.on('banned', this.handleBanned.bind(this));
      this.socket.on('moderation', this.handleModeration.bind(this));
      this.socket.on('chatHistory', this.handleChatHistory.bind(this));
      this.socket.on('clearChat', this.handleClearChat.bind(this));
      this.socket.on('userTyping', this.handleUserTyping.bind(this));
      this.socket.on('userStoppedTyping', this.handleUserStoppedTyping.bind(this));

      // Wait for connection
      return new Promise((resolve) => {
        this.socket.on('connect', () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve(true);
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connect error:', error);
          this.isConnecting = false;
          resolve(false);
        });
      });
    } catch (error) {
      console.error('Error initializing socket:', error);
      this.isConnecting = false;
      return false;
    }
  }

  /**
   * Connect to a chat room
   * @param {string} channelId - Channel ID
   * @returns {Promise<boolean>} Connection status
   */
  async joinRoom(channelId) {
    if (!this.socket || !this.socket.connected) {
      const connected = await this.initializeSocket();
      if (!connected) {
        return false;
      }
    }

    this.channelId = channelId;
    this.socket.emit('joinRoom', channelId);
    return true;
  }

  /**
   * Leave current chat room
   */
  leaveRoom() {
    if (this.socket && this.socket.connected && this.channelId) {
      this.socket.emit('leaveRoom', this.channelId);
      this.channelId = null;
    }
  }

  /**
   * Send a chat message
   * @param {string} content - Message content
   * @returns {boolean} Send status
   */
  sendMessage(content) {
    if (!this.socket || !this.socket.connected || !this.channelId) {
      return false;
    }

    this.socket.emit('chatMessage', {
      roomId: this.channelId,
      content,
      type: 'text'
    });

    return true;
  }

  /**
   * Send a donation
   * @param {number} amount - Token amount
   * @param {string} message - Donation message
   * @returns {boolean} Send status
   */
  sendDonation(amount, message = '') {
    if (!this.socket || !this.socket.connected || !this.channelId) {
      return false;
    }

    this.socket.emit('donation', {
      roomId: this.channelId,
      amount,
      message
    });

    return true;
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator() {
    if (!this.socket || !this.socket.connected || !this.channelId) {
      return false;
    }

    // Clear any existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.socket.emit('typing', { roomId: this.channelId });

    // Auto-clear typing indicator after 5 seconds
    this.typingTimeout = setTimeout(() => {
      this.sendStoppedTypingIndicator();
    }, 5000);

    return true;
  }

  /**
   * Send stopped typing indicator
   */
  sendStoppedTypingIndicator() {
    if (!this.socket || !this.socket.connected || !this.channelId) {
      return false;
    }

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    this.socket.emit('stoppedTyping', { roomId: this.channelId });
    return true;
  }

  /**
   * Timeout a user (moderator only)
   * @param {string} username - Username to timeout
   * @param {number} duration - Timeout duration in seconds
   * @param {string} reason - Timeout reason
   * @returns {boolean} Success status
   */
  timeoutUser(username, duration = 600, reason = '') {
    if (!this.socket || !this.socket.connected || !this.channelId) {
      return false;
    }

    this.socket.emit('timeout', {
      roomId: this.channelId,
      username,
      duration,
      reason
    });

    return true;
  }

  /**
   * Ban a user (moderator only)
   * @param {string} username - Username to ban
   * @param {string} reason - Ban reason
   * @returns {boolean} Success status
   */
  banUser(username, reason = '') {
    if (!this.socket || !this.socket.connected || !this.channelId) {
      return false;
    }

    this.socket.emit('ban', {
      roomId: this.channelId,
      username,
      reason
    });

    return true;
  }

  /**
   * Clear chat (moderator only)
   * @returns {boolean} Success status
   */
  clearChat() {
    if (!this.socket || !this.socket.connected || !this.channelId) {
      return false;
    }

    this.socket.emit('clearChat', {
      roomId: this.channelId
    });

    return true;
  }

  /**
   * Change chat mode (moderator only)
   * @param {string} mode - Chat mode (normal, subscribers, emote-only, followers, slow)
   * @param {number} duration - Duration for slow mode in seconds
   * @returns {boolean} Success status
   */
  setChatMode(mode, duration = 0) {
    if (!this.socket || !this.socket.connected || !this.channelId) {
      return false;
    }

    this.socket.emit('setChatMode', {
      roomId: this.channelId,
      mode,
      duration
    });

    return true;
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.channelId = null;
      this.isConnecting = false;
      
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
        this.typingTimeout = null;
      }
    }
  }

  /**
   * Register event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  /**
   * Remove event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler to remove
   */
  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }
  }

  // Socket event handlers
  handleConnect() {
    console.log('Socket connected');
    this.reconnectAttempts = 0;

    // Rejoin room if needed
    if (this.channelId) {
      this.socket.emit('joinRoom', this.channelId);
    }
  }

  handleDisconnect(reason) {
    console.log('Socket disconnected:', reason);

    // Auto-reconnect if not intentionally disconnected
    if (reason === 'io server disconnect' && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      
      const delay = Math.min(this.reconnectAttempts * 1000, 5000);
      
      this.reconnectTimer = setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
        this.socket.connect();
      }, delay);
    }
  }

  handleError(error) {
    console.error('Socket error:', error);
    this.eventHandlers.error.forEach(handler => handler(error));
  }

  handleChatMessage(message) {
    this.eventHandlers.chatMessage.forEach(handler => handler(message));
  }

  handleChatHistory(history) {
    // Process each message in history
    history.forEach(message => {
      this.handleChatMessage(message);
    });
  }

  handleDonation(donation) {
    this.eventHandlers.donation.forEach(handler => handler(donation));
  }

  handleUserJoined(user) {
    this.eventHandlers.userJoined.forEach(handler => handler(user));
  }

  handleUserLeft(user) {
    this.eventHandlers.userLeft.forEach(handler => handler(user));
  }

  handleRoomState(state) {
    this.eventHandlers.roomState.forEach(handler => handler(state));
  }

  handleTimeout(data) {
    this.eventHandlers.timeout.forEach(handler => handler(data));
  }

  handleBanned(data) {
    this.eventHandlers.banned.forEach(handler => handler(data));
  }

  handleModeration(data) {
    this.eventHandlers.moderation.forEach(handler => handler(data));
  }

  handleClearChat() {
    this.eventHandlers.clearChat.forEach(handler => handler());
  }

  handleUserTyping(user) {
    this.eventHandlers.userTyping.forEach(handler => handler(user));
  }

  handleUserStoppedTyping(user) {
    this.eventHandlers.userStoppedTyping.forEach(handler => handler(user));
  }
}

// Create a singleton instance
const chatService = new ChatService();

export default chatService;
