/**
 * Chat Service
 * Handles message processing, filtering, emote parsing, and other chat-related functionality
 */

const profanity = require('@2toad/profanity').profanity;
const logger = require('../utils/logger');
const emoteService = require('./emoteService');
const { ChatFilter } = require('../models/chat.model');

/**
 * Process a raw chat message
 * @param {string} content - Raw message content
 * @param {Object} options - Processing options
 * @param {Object} options.user - User information
 * @param {Object} options.room - Room information 
 * @param {Array} options.userEmotes - User's available emotes
 * @returns {Object} Processed message
 */
async function processMessage(content, options = {}) {
  try {
    const { user, room, userEmotes = [] } = options;
    
    // Trim message content
    let processedContent = content.trim();
    
    // Check if message is empty after trimming
    if (!processedContent) {
      return {
        filtered: true,
        reason: 'Empty message',
        content: '',
        parsedContent: '',
        emotes: []
      };
    }
    
    // Apply room-specific word filters
    if (room && room.wordFilters && room.wordFilters.length > 0) {
      // Get all word filters for this room
      const roomFilters = await ChatFilter.find({
        _id: { $in: room.wordFilters }
      });
      
      for (const filter of roomFilters) {
        const regex = new RegExp(filter.pattern, filter.flags || 'ig');
        
        if (regex.test(processedContent)) {
          if (filter.action === 'block') {
            return {
              filtered: true,
              reason: filter.reason || 'Message contained filtered word',
              content: processedContent,
              parsedContent: '',
              emotes: []
            };
          } else if (filter.action === 'replace') {
            processedContent = processedContent.replace(regex, filter.replacement || '***');
          }
        }
      }
    }
    
    // Apply global profanity filter if enabled for the room or user tier
    if (!room || room.enableProfanityFilter || user.tier === 'free') {
      // Configure profanity options
      profanity.setOptions({
        grawlix: '***',
        grawlixChar: '*',
        languages: ['en'],
        list: getCustomProfanityList(),
        exclude: getAllowedWords()
      });
      
      // Check if message contains profanity
      if (profanity.exists(processedContent)) {
        // For free users, block the message
        if (user.tier === 'free') {
          return {
            filtered: true,
            reason: 'Message contains inappropriate language',
            content: processedContent,
            parsedContent: '',
            emotes: []
          };
        }
        
        // For paid users, censor the words
        processedContent = profanity.censor(processedContent);
      }
    }
    
    // Check for excessive caps
    if (containsExcessiveCaps(processedContent) && (!user.isModerator && !user.isAdmin)) {
      // Convert to lowercase
      processedContent = processedContent.toLowerCase();
    }
    
    // Parse chat commands
    if (processedContent.startsWith('/')) {
      const commandResult = parseCommand(processedContent, options);
      if (commandResult.isCommand) {
        return commandResult;
      }
    }
    
    // Parse emotes
    const emoteParseResult = await parseEmotes(processedContent, userEmotes);
    
    return {
      filtered: false,
      content: processedContent,
      parsedContent: emoteParseResult.parsedContent,
      emotes: emoteParseResult.emotes
    };
  } catch (error) {
    logger.error('Error processing message:', error);
    return {
      filtered: true,
      reason: 'Error processing message',
      content: content,
      parsedContent: '',
      emotes: []
    };
  }
}

/**
 * Check if message contains excessive caps
 * @param {string} content - Message content
 * @returns {boolean} - True if message contains excessive caps
 */
function containsExcessiveCaps(content) {
  // Skip short messages
  if (content.length < 10) {
    return false;
  }
  
  // Count uppercase letters
  let uppercaseCount = 0;
  let letterCount = 0;
  
  for (const char of content) {
    if (/[A-Za-z]/.test(char)) {
      letterCount++;
      
      if (/[A-Z]/.test(char)) {
        uppercaseCount++;
      }
    }
  }
  
  // If more than 70% of letters are uppercase, consider it excessive caps
  return letterCount > 0 && (uppercaseCount / letterCount) > 0.7;
}

/**
 * Parse a chat command
 * @param {string} content - Message content
 * @param {Object} options - Options containing user and room info
 * @returns {Object} - Command parse result
 */
function parseCommand(content, options) {
  const { user, room } = options;
  
  // Split command and arguments
  const [command, ...args] = content.slice(1).split(' ');
  
  switch (command.toLowerCase()) {
    case 'me':
      // Action message (/me is dancing)
      return {
        isCommand: true,
        filtered: false,
        type: 'action',
        content: args.join(' '),
        parsedContent: args.join(' '),
        emotes: []
      };
      
    case 'color':
      // Change user color (/color #FF0000)
      if (args.length === 0) {
        return {
          isCommand: true,
          filtered: true,
          reason: 'Please specify a color (e.g., /color #FF0000)',
          content: content,
          parsedContent: '',
          emotes: []
        };
      }
      
      // Validate color format
      const colorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!colorRegex.test(args[0])) {
        return {
          isCommand: true,
          filtered: true,
          reason: 'Invalid color format. Use hex format (e.g., #FF0000)',
          content: content,
          parsedContent: '',
          emotes: []
        };
      }
      
      // Only allow color change for authenticated users
      if (!user.isAuthenticated) {
        return {
          isCommand: true,
          filtered: true,
          reason: 'You must be logged in to change your color',
          content: content,
          parsedContent: '',
          emotes: []
        };
      }
      
      return {
        isCommand: true,
        actionType: 'colorChange',
        color: args[0],
        content: content,
        parsedContent: `Color changed to ${args[0]}`,
        emotes: []
      };
      
    case 'whisper':
    case 'w':
      // Private message (/whisper username message)
      if (args.length < 2) {
        return {
          isCommand: true,
          filtered: true,
          reason: 'Please specify a user and message (e.g., /whisper username message)',
          content: content,
          parsedContent: '',
          emotes: []
        };
      }
      
      return {
        isCommand: true,
        actionType: 'whisper',
        targetUsername: args[0],
        content: args.slice(1).join(' '),
        parsedContent: args.slice(1).join(' '),
        emotes: []
      };
      
    case 'poll':
      // Create a poll (/poll "Question" "Option 1" "Option 2" ...)
      // Only moderators and admins can create polls
      if (!user.isModerator && !user.isAdmin) {
        return {
          isCommand: true,
          filtered: true,
          reason: 'Only moderators can create polls',
          content: content,
          parsedContent: '',
          emotes: []
        };
      }
      
      // Parse poll arguments (handling quoted strings)
      const pollArgs = parseQuotedArgs(args.join(' '));
      
      if (pollArgs.length < 3) {
        return {
          isCommand: true,
          filtered: true,
          reason: 'Please provide a question and at least two options (e.g., /poll "Question" "Option 1" "Option 2")',
          content: content,
          parsedContent: '',
          emotes: []
        };
      }
      
      return {
        isCommand: true,
        actionType: 'poll',
        question: pollArgs[0],
        options: pollArgs.slice(1),
        content: content,
        parsedContent: `Poll created: ${pollArgs[0]}`,
        emotes: []
      };
      
    default:
      // Unknown command
      return {
        isCommand: false,
        filtered: false,
        content: content,
        parsedContent: content,
        emotes: []
      };
  }
}

/**
 * Parse quoted arguments from a string
 * @param {string} argsString - String containing quoted arguments
 * @returns {Array} - Array of parsed arguments
 */
function parseQuotedArgs(argsString) {
  const args = [];
  let currentArg = '';
  let inQuotes = false;
  
  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
      
      // If we're closing quotes and have content, add it to args
      if (!inQuotes && currentArg) {
        args.push(currentArg);
        currentArg = '';
      }
    } else if (inQuotes) {
      currentArg += char;
    } else if (char !== ' ' || currentArg) {
      // Only add non-quote, non-space characters if we're building an argument
      // or if the character isn't a space
      currentArg += char;
    }
  }
  
  // Add the last argument if there is one
  if (currentArg) {
    args.push(currentArg);
  }
  
  return args;
}

/**
 * Parse emotes in a message
 * @param {string} content - Message content
 * @param {Array} userEmotes - User's available emotes
 * @returns {Object} - Parsed message with emotes
 */
async function parseEmotes(content, userEmotes = []) {
  try {
    // Get global emotes
    const globalEmotes = await emoteService.getGlobalEmotes();
    
    // Combine user and global emotes
    const availableEmotes = [...globalEmotes, ...userEmotes];
    
    // Find emotes in the message
    const emotes = [];
    let parsedContent = content;
    
    // Sort emotes by length (longest first) to prevent substring matching issues
    availableEmotes.sort((a, b) => b.code.length - a.code.length);
    
    for (const emote of availableEmotes) {
      // Find all instances of this emote
      const regex = new RegExp(`\\b${escapeRegExp(emote.code)}\\b`, 'g');
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        emotes.push({
          id: emote.id,
          code: emote.code,
          startIndex: match.index,
          endIndex: match.index + emote.code.length - 1,
          url: emote.url
        });
      }
      
      // Replace emote codes with placeholders for rendering
      parsedContent = parsedContent.replace(regex, `<emote:${emote.id}>`);
    }
    
    return {
      parsedContent,
      emotes
    };
  } catch (error) {
    logger.error('Error parsing emotes:', error);
    return {
      parsedContent: content,
      emotes: []
    };
  }
}

/**
 * Escape special regex characters in a string
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get custom profanity list
 * @returns {Array} - Array of profane words
 */
function getCustomProfanityList() {
  // This would be loaded from a database in production
  return [
    // Add additional words to filter
  ];
}

/**
 * Get list of allowed words (false positives)
 * @returns {Array} - Array of allowed words
 */
function getAllowedWords() {
  // This would be loaded from a database in production
  return [
    // Words that might be flagged as profanity but are allowed
  ];
}

module.exports = {
  processMessage
};
