/**
 * Advanced Socket.io Server for Clipt Platform
 * Provides real-time chat functionality with features similar to Twitch
 * Supports thousands of concurrent users with horizontal scaling
 */

const socketIo = require('socket.io');
const http = require('http');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const logger = require('./utils/logger');
const { processMessage } = require('./services/chatService');
const { recordChatActivity } = require('./services/analyticsService');
const { ChatMessage, ChatRoom, UserConnection } = require('./models/chat.model');
const config = require('./config');
const emoteService = require('./services/emoteService');

// Create Redis clients for pub/sub
const pubClient = new Redis(config.redis.url);
const subClient = pubClient.duplicate();

// Create rate limiters
const messageLimiter = new RateLimiterMemory({
  points: 10,        // 10 messages
  duration: 10,      // per 10 seconds
});

const connectionLimiter = new RateLimiterMemory({
  points: 5,         // 5 connections
  duration: 60 * 15, // per 15 minutes
});

// Initialize services
const chatService = new ChatService(pubClient);
const emoteService = new EmoteService(pubClient);

// Room state cache
const roomStates = new Map();
const userRooms = new Map();
const userTimeouts = new Map();

/**
 * Initialize Socket.IO server with Redis adapter and authentication middleware
 * @param {Object} httpServer - HTTP server instance
 * @returns {Object} socket.io instance
 */
function initializeSocketServer(httpServer) {
  const io = socketIo(httpServer, {
    cors: {
      origin: config.allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    maxHttpBufferSize: 1e6, // 1MB max message size
    pingTimeout: 30000,
    pingInterval: 25000
  });
  
  // Use Redis adapter for horizontal scaling
  io.adapter(createAdapter(pubClient, subClient));
  
  // Connection authentication middleware

  // Middleware for authentication and rate limiting
  io.use(async (socket, next) => {
    try {
      // Get token from handshake
      const token = socket.handshake.auth.token || 
                    socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        // Allow anonymous users, but with limited capabilities
        socket.user = { 
          isAuthenticated: false,
          username: `Guest${Math.floor(Math.random() * 10000)}`,
          tier: 'guest'
        };
        return next();
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Rate limit connections per IP
      const ip = socket.handshake.address;
      try {
        await connectionLimiter.consume(ip);
      } catch (rateLimitError) {
        logger.warn(`Connection rate limit exceeded for IP: ${ip}`);
        return next(new Error('Too many connection attempts, please try again later'));
      }

      // Set user data on socket
      socket.user = {
        isAuthenticated: true,
        userId: decoded.id,
        username: decoded.username,
        tier: decoded.tier || 'free',
        isModerator: Boolean(decoded.isModerator),
        isAdmin: Boolean(decoded.isAdmin),
        badges: decoded.badges || [],
        color: decoded.color || generateUserColor(decoded.username)
      };

      // Load user's emotes
      socket.userEmotes = await emoteService.getUserEmotes(decoded.id);
      
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return next(new Error('Invalid authentication token'));
      }
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.username} (${socket.id})`);
    
    // Track connection in database
    const userConnection = new UserConnection({
      socketId: socket.id,
      userId: socket.user.userId,
      username: socket.user.username,
      isAuthenticated: socket.user.isAuthenticated,
      userAgent: socket.handshake.headers['user-agent'],
      ipAddress: socket.handshake.address,
      connectedAt: new Date()
    });
    
    userConnection.save()
      .catch(err => logger.error('Error saving user connection:', err));

    // --- Room Management ---
    
    /**
     * Join a chat room
     */
    socket.on('joinRoom', async (roomId) => {
      try {
        // Validate room
        const room = await ChatRoom.findById(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        
        // Check if room requires authentication
        if (room.requiresAuth && !socket.user.isAuthenticated) {
          socket.emit('error', { message: 'This room requires authentication' });
          return;
        }
        
        // Check if room is subscriber-only
        if (room.subscriberOnly && socket.user.tier === 'free') {
          socket.emit('error', { message: 'This room is subscriber-only' });
          return;
        }
        
        // Join the room
        socket.join(roomId);
        
        // Notify room about new user
        socket.to(roomId).emit('userJoined', {
          username: socket.user.username,
          tier: socket.user.tier,
          badges: socket.user.badges,
          color: socket.user.color
        });
        
        // Get recent chat history (last 50 messages)
        const chatHistory = await ChatMessage.find({
          roomId: roomId
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('userId', 'username tier badges color')
        .lean();
        
        // Send chat history
        socket.emit('chatHistory', chatHistory.reverse());
        
        logger.info(`User ${socket.user.username} joined room: ${room.name}`);
      } catch (error) {
        logger.error(`Error joining room:`, error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });
    
    /**
     * Leave a chat room
     */
    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);
      socket.to(roomId).emit('userLeft', {
        username: socket.user.username
      });
      logger.info(`User ${socket.user.username} left room: ${roomId}`);
    });

    // --- Chat Messages ---
    
    /**
     * Handle chat message
     */
    socket.on('chatMessage', async (data) => {
      try {
        const { roomId, content, type = 'text' } = data;
        
        // Check if user is in the room
        if (!socket.rooms.has(roomId)) {
          socket.emit('error', { message: 'You are not in this room' });
          return;
        }
        
        // Rate limit based on tier
        try {
          // Higher tiers get higher limits/reduced points consumption
          const pointsToConsume = socket.user.tier === 'premium' ? 0.5 : 
                                 socket.user.tier === 'basic' ? 0.7 : 1;
                                 
          await messageLimiter.consume(`${socket.user.userId || socket.id}`, pointsToConsume);
        } catch (rateLimitError) {
          socket.emit('error', { 
            message: 'You are sending messages too quickly. Please wait a moment.' 
          });
          return;
        }
        
        // Get room settings
        const room = await ChatRoom.findById(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        
        // Check if room is in slow mode
        if (room.slowMode) {
          const lastMessage = await ChatMessage.findOne({
            roomId,
            'user.userId': socket.user.userId || socket.id
          }).sort({ createdAt: -1 });
          
          if (lastMessage) {
            const secondsSinceLastMessage = (Date.now() - lastMessage.createdAt) / 1000;
            const slowModeDelay = room.slowModeDelay || 3; // Default 3 seconds
            
            if (secondsSinceLastMessage < slowModeDelay) {
              socket.emit('error', { 
                message: `Slow mode is enabled. Please wait ${Math.ceil(slowModeDelay - secondsSinceLastMessage)} seconds.` 
              });
              return;
            }
          }
        }
        
        // Check message length based on tier
        const maxLength = socket.user.tier === 'premium' ? 500 : 
                         socket.user.tier === 'basic' ? 300 : 200;
                         
        if (content.length > maxLength) {
          socket.emit('error', { 
            message: `Message exceeds maximum length of ${maxLength} characters for your tier` 
          });
          return;
        }
        
        // Process message (filter, parse emotes, etc)
        const processedMessage = await processMessage(content, {
          user: socket.user,
          room,
          userEmotes: socket.userEmotes || []
        });
        
        // Check if message was filtered
        if (processedMessage.filtered) {
          socket.emit('error', { message: 'Your message was filtered' });
          return;
        }
        
        // Create message object
        const message = {
          id: generateMessageId(),
          roomId,
          type,
          content: processedMessage.content,
          parsedContent: processedMessage.parsedContent,
          user: {
            userId: socket.user.userId,
            username: socket.user.username,
            tier: socket.user.tier,
            badges: socket.user.badges,
            color: socket.user.color,
            isModerator: socket.user.isModerator,
            isAdmin: socket.user.isAdmin
          },
          emotes: processedMessage.emotes,
          createdAt: new Date()
        };
        
        // Save message to database
        const chatMessage = new ChatMessage(message);
        await chatMessage.save();
        
        // Broadcast message to room
        io.to(roomId).emit('chatMessage', message);
        
        // Record analytics
        recordChatActivity({
          type: 'message',
          userId: socket.user.userId,
          roomId,
          messageId: message.id
        });
      } catch (error) {
        logger.error('Error processing chat message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // --- Donation and Monetization ---
    
    /**
     * Handle token donation/bits
     */
    socket.on('donation', async (data) => {
      try {
        const { roomId, amount, message } = data;
        
        // Authenticate user
        if (!socket.user.isAuthenticated) {
          socket.emit('error', { message: 'You must be logged in to donate' });
          return;
        }
        
        // Validate donation amount
        if (!amount || amount < 1) {
          socket.emit('error', { message: 'Invalid donation amount' });
          return;
        }
        
        // Check user balance (would use actual token service in production)
        // const userBalance = await tokenService.getUserBalance(socket.user.userId);
        // if (userBalance < amount) {
        //   socket.emit('error', { message: 'Insufficient token balance' });
        //   return;
        // }
        
        // Process donation (would use actual token service in production)
        // await tokenService.processTransaction({
        //   fromUserId: socket.user.userId,
        //   toRoomId: roomId,
        //   amount,
        //   type: 'donation',
        //   message
        // });
        
        // Create donation message
        const donationMessage = {
          id: generateMessageId(),
          roomId,
          type: 'donation',
          amount,
          message: message || '',
          user: {
            userId: socket.user.userId,
            username: socket.user.username,
            tier: socket.user.tier,
            badges: socket.user.badges,
            color: socket.user.color
          },
          createdAt: new Date()
        };
        
        // Broadcast donation to room
        io.to(roomId).emit('donation', donationMessage);
        
        // Record analytics
        recordChatActivity({
          type: 'donation',
          userId: socket.user.userId,
          roomId,
          amount
        });
      } catch (error) {
        logger.error('Error processing donation:', error);
        socket.emit('error', { message: 'Failed to process donation' });
      }
    });

    // --- Moderation Tools ---
    
    /**
     * Timeout a user
     */
    socket.on('timeout', async (data) => {
      try {
        const { roomId, username, duration, reason } = data;
        
        // Check moderator privileges
        if (!socket.user.isModerator && !socket.user.isAdmin) {
          socket.emit('error', { message: 'You do not have permission to timeout users' });
          return;
        }
        
        // Find target user sockets in this room
        const room = io.sockets.adapter.rooms.get(roomId);
        let targetSocket = null;
        
        // Find the socket for the username to timeout
        for (const socketId of room || []) {
          const userSocket = io.sockets.sockets.get(socketId);
          if (userSocket.user.username === username) {
            targetSocket = userSocket;
            break;
          }
        }
        
        if (!targetSocket) {
          socket.emit('error', { message: 'User not found in this room' });
          return;
        }
        
        // Don't allow timing out moderators/admins unless you're an admin
        if ((targetSocket.user.isModerator || targetSocket.user.isAdmin) && !socket.user.isAdmin) {
          socket.emit('error', { message: 'Cannot timeout other moderators or admins' });
          return;
        }
        
        // Set timeout flag on user
        targetSocket.user.timeoutUntil = Date.now() + (duration * 1000);
        targetSocket.user.timeoutReason = reason || 'Violated chat rules';
        
        // Notify the timed out user
        targetSocket.emit('timeout', {
          duration,
          reason: targetSocket.user.timeoutReason,
          moderator: socket.user.username
        });
        
        // Notify the room
        io.to(roomId).emit('moderation', {
          type: 'timeout',
          username,
          duration,
          reason: targetSocket.user.timeoutReason,
          moderator: socket.user.username
        });
        
        logger.info(`User ${username} timed out for ${duration}s by ${socket.user.username} in room ${roomId}`);
      } catch (error) {
        logger.error('Error timing out user:', error);
        socket.emit('error', { message: 'Failed to timeout user' });
      }
    });
    
    /**
     * Ban a user
     */
    socket.on('ban', async (data) => {
      try {
        const { roomId, username, reason } = data;
        
        // Check moderator privileges
        if (!socket.user.isModerator && !socket.user.isAdmin) {
          socket.emit('error', { message: 'You do not have permission to ban users' });
          return;
        }
        
        // Find target user sockets in this room
        const room = io.sockets.adapter.rooms.get(roomId);
        let targetSocket = null;
        
        // Find the socket for the username to ban
        for (const socketId of room || []) {
          const userSocket = io.sockets.sockets.get(socketId);
          if (userSocket.user.username === username) {
            targetSocket = userSocket;
            break;
          }
        }
        
        if (!targetSocket) {
          socket.emit('error', { message: 'User not found in this room' });
          return;
        }
        
        // Don't allow banning moderators/admins unless you're an admin
        if ((targetSocket.user.isModerator || targetSocket.user.isAdmin) && !socket.user.isAdmin) {
          socket.emit('error', { message: 'Cannot ban other moderators or admins' });
          return;
        }
        
        // Add user to banned list for the room
        await ChatRoom.findByIdAndUpdate(roomId, {
          $addToSet: {
            bannedUsers: {
              userId: targetSocket.user.userId,
              username: targetSocket.user.username,
              reason: reason || 'Violated chat rules',
              bannedBy: socket.user.username,
              bannedAt: new Date()
            }
          }
        });
        
        // Notify the banned user
        targetSocket.emit('banned', {
          reason: reason || 'Violated chat rules',
          moderator: socket.user.username
        });
        
        // Remove user from room
        targetSocket.leave(roomId);
        
        // Notify the room
        io.to(roomId).emit('moderation', {
          type: 'ban',
          username,
          reason: reason || 'Violated chat rules',
          moderator: socket.user.username
        });
        
        logger.info(`User ${username} banned by ${socket.user.username} in room ${roomId}`);
      } catch (error) {
        logger.error('Error banning user:', error);
        socket.emit('error', { message: 'Failed to ban user' });
      }
    });

    // --- Connection Management ---
    
    /**
     * Handle disconnection
     */
    socket.on('disconnect', async () => {
      try {
        logger.info(`User disconnected: ${socket.user.username} (${socket.id})`);
        
        // Update connection record
        await UserConnection.findOneAndUpdate(
          { socketId: socket.id },
          { disconnectedAt: new Date() }
        );
        
        // Notify rooms
        for (const roomId of socket.rooms) {
          // Skip the socket's own room
          if (roomId === socket.id) continue;
          
          socket.to(roomId).emit('userLeft', {
            username: socket.user.username
          });
        }
      } catch (error) {
        logger.error('Error handling disconnect:', error);
      }
    });
  });

  return io;
}

/**
 * Generate a unique message ID
 * @returns {string} Unique message ID
 */
function generateMessageId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Generate a user color based on username
 * @param {string} username Username
 * @returns {string} Color hex code
 */
function generateUserColor(username) {
  const colors = [
    '#FF4500', '#1E90FF', '#008000', '#B22222',
    '#9400D3', '#FF8C00', '#00CED1', '#FF69B4',
    '#008B8B', '#8A2BE2', '#00FF7F', '#DAA520'
  ];
  
  // Generate deterministic index based on username
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

module.exports = {
  initializeSocketServer
};
