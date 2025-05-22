/**
 * Chat System Initialization Script
 * Creates and seeds database collections for the chat system
 */

const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');

// Import models
const Emote = require('../models/Emote');
const EmoteSet = require('../models/EmoteSet');
const ChatMessage = require('../models/ChatMessage');
const ChannelBan = require('../models/ChannelBan');
const ChannelModerator = require('../models/ChannelModerator');
const User = require('../models/User');
const Channel = require('../models/Channel');

async function initializeChatSystem() {
  try {
    logger.info('Starting chat system initialization...');
    
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      logger.info('Connecting to MongoDB...');
      await mongoose.connect(config.mongodb.uri);
      logger.info('Connected to MongoDB');
    }
    
    // Initialize default emotes
    logger.info('Initializing default emotes...');
    const emoteCount = await Emote.initializeDefaultEmotes();
    logger.info(`Created ${emoteCount} default emotes`);
    
    // Initialize default emote sets
    logger.info('Initializing default emote sets...');
    const emoteSetCount = await EmoteSet.initializeDefaultEmoteSets();
    logger.info(`Created ${emoteSetCount} default emote sets`);
    
    // Add admin users as global moderators
    logger.info('Setting up global moderators...');
    const adminUsers = await User.find({ isAdmin: true });
    
    if (adminUsers.length > 0) {
      logger.info(`Found ${adminUsers.length} admin users`);
      
      // Get all channels
      const channels = await Channel.find({});
      logger.info(`Found ${channels.length} channels`);
      
      // For each channel, make sure admins are moderators
      for (const admin of adminUsers) {
        for (const channel of channels) {
          // Skip if channel owner is the admin (already has mod powers)
          if (channel.ownerId.toString() === admin._id.toString()) {
            continue;
          }
          
          const isModerator = await ChannelModerator.isUserModerator(channel._id, admin._id);
          
          if (!isModerator) {
            await ChannelModerator.addModerator(
              channel._id,
              admin._id,
              channel.ownerId,
              {
                canBan: true,
                canTimeout: true,
                canDeleteMessages: true,
                canManageMods: true,
                canChangeChatMode: true
              }
            );
            
            logger.info(`Added admin ${admin.username} as moderator for channel ${channel.displayName || channel.username}`);
          }
        }
      }
    }
    
    // Create system welcome message for each channel
    logger.info('Creating welcome messages...');
    const welcomeMessageCount = await createWelcomeMessages(channels);
    logger.info(`Created ${welcomeMessageCount} welcome messages`);
    
    logger.info('Chat system initialization completed successfully');
    return true;
  } catch (error) {
    logger.error('Error initializing chat system:', error);
    return false;
  }
}

/**
 * Create welcome messages for each channel
 * @param {Array} channels - List of channels
 * @returns {Promise<Number>} Number of messages created
 */
async function createWelcomeMessages(channels) {
  let count = 0;
  
  for (const channel of channels) {
    // Check if channel already has messages
    const existingMessages = await ChatMessage.countDocuments({ roomId: channel._id });
    
    if (existingMessages === 0) {
      // Create welcome message
      const welcomeMessage = new ChatMessage({
        roomId: channel._id,
        user: {
          userId: null,
          username: 'CliptBot',
          tier: 'maxed',
          badges: ['admin'],
          isAdmin: true
        },
        content: `Welcome to ${channel.displayName || channel.username}'s chat! Remember to be respectful and follow channel rules.`,
        type: 'system',
        createdAt: new Date()
      });
      
      await welcomeMessage.save();
      count++;
    }
  }
  
  return count;
}

// Run if this script is called directly
if (require.main === module) {
  initializeChatSystem()
    .then(() => {
      logger.info('Initialization script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Initialization script failed:', error);
      process.exit(1);
    });
}

module.exports = initializeChatSystem;
