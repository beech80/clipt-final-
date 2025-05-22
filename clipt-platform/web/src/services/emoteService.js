/**
 * Emote Service
 * Manages emote retrieval, caching, and processing for the chat interface
 */

import api from './api';

class EmoteService {
  constructor() {
    this.emoteCache = {
      global: [],
      channel: {},
      user: {}
    };
    this.emoteCodeMap = new Map();
    this.recentEmotes = [];
    this.MAX_RECENT_EMOTES = 20;
    
    // Try to load recent emotes from localStorage
    this.loadRecentEmotes();
  }
  
  /**
   * Load recent emotes from localStorage
   */
  loadRecentEmotes() {
    try {
      const storedEmotes = localStorage.getItem('clipt_recent_emotes');
      if (storedEmotes) {
        this.recentEmotes = JSON.parse(storedEmotes);
      }
    } catch (error) {
      console.error('Error loading recent emotes:', error);
      this.recentEmotes = [];
    }
  }
  
  /**
   * Save recent emotes to localStorage
   */
  saveRecentEmotes() {
    try {
      localStorage.setItem('clipt_recent_emotes', JSON.stringify(this.recentEmotes));
    } catch (error) {
      console.error('Error saving recent emotes:', error);
    }
  }
  
  /**
   * Add an emote to recent emotes list
   * @param {Object} emote - Emote object to add
   */
  addRecentEmote(emote) {
    // Remove emote if already in list
    this.recentEmotes = this.recentEmotes.filter(e => e.id !== emote.id);
    
    // Add to front of list
    this.recentEmotes.unshift(emote);
    
    // Trim list if needed
    if (this.recentEmotes.length > this.MAX_RECENT_EMOTES) {
      this.recentEmotes = this.recentEmotes.slice(0, this.MAX_RECENT_EMOTES);
    }
    
    // Save to localStorage
    this.saveRecentEmotes();
  }
  
  /**
   * Get recent emotes
   * @returns {Array} Recent emotes
   */
  getRecentEmotes() {
    return this.recentEmotes;
  }
  
  /**
   * Clear emote cache
   * @param {string} type - Cache type to clear (global, channel, user, all)
   * @param {string} id - ID for channel or user cache
   */
  clearCache(type = 'all', id = '') {
    if (type === 'global' || type === 'all') {
      this.emoteCache.global = [];
    }
    
    if (type === 'channel' || type === 'all') {
      if (id) {
        delete this.emoteCache.channel[id];
      } else {
        this.emoteCache.channel = {};
      }
    }
    
    if (type === 'user' || type === 'all') {
      if (id) {
        delete this.emoteCache.user[id];
      } else {
        this.emoteCache.user = {};
      }
    }
    
    // Rebuild code map
    this.rebuildCodeMap();
  }
  
  /**
   * Rebuild emote code map for quick lookups
   */
  rebuildCodeMap() {
    this.emoteCodeMap.clear();
    
    // Add global emotes
    this.emoteCache.global.forEach(emote => {
      this.emoteCodeMap.set(emote.code.toLowerCase(), emote);
    });
    
    // Add channel emotes
    Object.values(this.emoteCache.channel).forEach(emotes => {
      emotes.forEach(emote => {
        this.emoteCodeMap.set(emote.code.toLowerCase(), emote);
      });
    });
    
    // Add user emotes
    Object.values(this.emoteCache.user).forEach(emotes => {
      emotes.forEach(emote => {
        this.emoteCodeMap.set(emote.code.toLowerCase(), emote);
      });
    });
  }
  
  /**
   * Get global emotes
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Array>} Global emotes
   */
  async getGlobalEmotes(forceRefresh = false) {
    if (this.emoteCache.global.length > 0 && !forceRefresh) {
      return this.emoteCache.global;
    }
    
    try {
      const response = await api.get('/emotes/global');
      this.emoteCache.global = response.data;
      this.rebuildCodeMap();
      return this.emoteCache.global;
    } catch (error) {
      console.error('Error fetching global emotes:', error);
      
      // Return some fallback emotes if API call fails
      return [
        { id: 'smile', code: ':smile:', name: 'Smile', url: '/assets/emotes/smile.png' },
        { id: 'lol', code: ':lol:', name: 'LOL', url: '/assets/emotes/lol.png' },
        { id: 'clipt', code: ':clipt:', name: 'Clipt', url: '/assets/emotes/clipt.png' },
        { id: 'love', code: ':love:', name: 'Love', url: '/assets/emotes/love.png' }
      ];
    }
  }
  
  /**
   * Get channel emotes
   * @param {string} channelId - Channel ID
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Array>} Channel emotes
   */
  async getChannelEmotes(channelId, forceRefresh = false) {
    if (this.emoteCache.channel[channelId] && !forceRefresh) {
      return this.emoteCache.channel[channelId];
    }
    
    try {
      const response = await api.get(`/emotes/channel/${channelId}`);
      this.emoteCache.channel[channelId] = response.data;
      this.rebuildCodeMap();
      return this.emoteCache.channel[channelId];
    } catch (error) {
      console.error(`Error fetching channel emotes for ${channelId}:`, error);
      return [];
    }
  }
  
  /**
   * Get user emotes based on subscription tier
   * @param {string} tier - Subscription tier
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Array>} User tier emotes
   */
  async getTierEmotes(tier, forceRefresh = false) {
    const cacheKey = `tier_${tier}`;
    
    if (this.emoteCache.user[cacheKey] && !forceRefresh) {
      return this.emoteCache.user[cacheKey];
    }
    
    try {
      const response = await api.get(`/emotes/tier/${tier}`);
      this.emoteCache.user[cacheKey] = response.data;
      this.rebuildCodeMap();
      return this.emoteCache.user[cacheKey];
    } catch (error) {
      console.error(`Error fetching tier emotes for ${tier}:`, error);
      
      // Return fallback emotes based on tier
      if (tier === 'pro') {
        return [
          { id: 'pro_hype', code: ':prohype:', name: 'Pro Hype', url: '/assets/emotes/pro_hype.gif', isAnimated: true },
          { id: 'pro_cool', code: ':procool:', name: 'Pro Cool', url: '/assets/emotes/pro_cool.png' }
        ];
      } else if (tier === 'maxed') {
        return [
          { id: 'maxed_fire', code: ':maxedfire:', name: 'Maxed Fire', url: '/assets/emotes/maxed_fire.gif', isAnimated: true },
          { id: 'maxed_king', code: ':maxedking:', name: 'Maxed King', url: '/assets/emotes/maxed_king.gif', isAnimated: true }
        ];
      }
      
      return [];
    }
  }
  
  /**
   * Get all available emotes for a user in a channel
   * @param {Object} options - Options
   * @param {string} options.channelId - Channel ID
   * @param {string} options.tier - User subscription tier
   * @returns {Promise<Array>} All available emotes
   */
  async getAllEmotes({ channelId, tier = 'free' }) {
    const [globalEmotes, channelEmotes, tierEmotes] = await Promise.all([
      this.getGlobalEmotes(),
      channelId ? this.getChannelEmotes(channelId) : [],
      tier !== 'free' ? this.getTierEmotes(tier) : []
    ]);
    
    // Combine all emotes and remove duplicates
    const allEmotes = [...globalEmotes, ...channelEmotes, ...tierEmotes];
    const uniqueEmotes = [];
    const emoteIds = new Set();
    
    allEmotes.forEach(emote => {
      if (!emoteIds.has(emote.id)) {
        uniqueEmotes.push(emote);
        emoteIds.add(emote.id);
      }
    });
    
    return uniqueEmotes;
  }
  
  /**
   * Parse emotes in a message
   * @param {string} content - Message content
   * @param {Array} availableEmotes - Available emotes
   * @returns {Object} Parsed content and emotes
   */
  parseEmotes(content, availableEmotes = []) {
    if (!content) return { parsedContent: '', emotes: [] };
    
    // Use regex to find emote patterns in the message
    // Basic pattern: :emoteName:
    const emotePattern = /:([\w]+):/g;
    const emoteMatches = Array.from(content.matchAll(emotePattern));
    
    // Create a map of emote code -> emote object for quick lookup
    const emoteMap = new Map();
    availableEmotes.forEach(emote => {
      const code = emote.code.replace(/:/g, '').toLowerCase(); // Strip colons for comparison
      emoteMap.set(code, emote);
    });
    
    let parsedContent = content;
    const usedEmotes = [];
    
    // Replace emote codes with placeholder tags
    for (const match of emoteMatches) {
      const emoteCode = match[1].toLowerCase();
      const emote = emoteMap.get(emoteCode) || this.emoteCodeMap.get(`:${emoteCode}:`);
      
      if (emote) {
        // Replace the emote code with a placeholder tag
        parsedContent = parsedContent.replace(
          `:${match[1]}:`,
          `<emote:${emote.id}>`
        );
        
        // Add emote to used emotes if not already added
        if (!usedEmotes.find(e => e.id === emote.id)) {
          usedEmotes.push(emote);
          
          // Add to recent emotes
          this.addRecentEmote(emote);
        }
      }
    }
    
    return {
      parsedContent,
      emotes: usedEmotes
    };
  }
  
  /**
   * Search for emotes
   * @param {string} query - Search query
   * @returns {Promise<Array>} Search results
   */
  async searchEmotes(query) {
    try {
      const response = await api.get(`/emotes/search?q=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      console.error('Error searching for emotes:', error);
      
      // Search locally in cache as fallback
      const results = [];
      const lowerQuery = query.toLowerCase();
      
      // Search global emotes
      this.emoteCache.global.forEach(emote => {
        if (emote.code.toLowerCase().includes(lowerQuery) || emote.name.toLowerCase().includes(lowerQuery)) {
          results.push(emote);
        }
      });
      
      // Search channel emotes
      Object.values(this.emoteCache.channel).forEach(emotes => {
        emotes.forEach(emote => {
          if (emote.code.toLowerCase().includes(lowerQuery) || emote.name.toLowerCase().includes(lowerQuery)) {
            if (!results.find(e => e.id === emote.id)) {
              results.push(emote);
            }
          }
        });
      });
      
      // Search user emotes
      Object.values(this.emoteCache.user).forEach(emotes => {
        emotes.forEach(emote => {
          if (emote.code.toLowerCase().includes(lowerQuery) || emote.name.toLowerCase().includes(lowerQuery)) {
            if (!results.find(e => e.id === emote.id)) {
              results.push(emote);
            }
          }
        });
      });
      
      return results;
    }
  }
}

// Create singleton instance
const emoteService = new EmoteService();

export default emoteService;
