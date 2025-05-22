import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './StreamChat.css';

/**
 * EmotePicker Component
 * 
 * Displays a categorized panel of emotes that users can select and insert into chat messages
 * Features:
 * - Global emotes available to all users
 * - Subscription tier-specific emotes
 * - Channel-specific emotes
 * - Recently used emotes
 * - Search functionality
 */
const EmotePicker = ({ 
  onSelectEmote, 
  onClose, 
  userTier = 'free',
  channelId
}) => {
  // Emote categories
  const [activeTab, setActiveTab] = useState('recent');
  const [emotes, setEmotes] = useState({
    global: [],
    tier: [],
    channel: [],
    recent: []
  });
  const [selectedEmote, setSelectedEmote] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEmotes, setFilteredEmotes] = useState([]);
  
  // Fetch emotes on mount
  useEffect(() => {
    const fetchEmotes = async () => {
      try {
        setIsLoading(true);
        
        // Fetch global emotes
        const globalEmotes = await fetchGlobalEmotes();
        
        // Fetch tier-specific emotes
        const tierEmotes = await fetchTierEmotes(userTier);
        
        // Fetch channel-specific emotes
        const channelEmotes = channelId ? await fetchChannelEmotes(channelId) : [];
        
        // Get recently used emotes from local storage
        const recentEmotes = getRecentEmotes();
        
        // Update state
        setEmotes({
          global: globalEmotes,
          tier: tierEmotes,
          channel: channelEmotes,
          recent: recentEmotes
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching emotes:', error);
        setIsLoading(false);
      }
    };
    
    fetchEmotes();
  }, [userTier, channelId]);
  
  // Filter emotes based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredEmotes([]);
      return;
    }
    
    const lowerCaseSearch = searchTerm.toLowerCase();
    const results = [
      ...emotes.global,
      ...emotes.tier,
      ...emotes.channel
    ].filter(emote => 
      emote.code.toLowerCase().includes(lowerCaseSearch) ||
      emote.name?.toLowerCase().includes(lowerCaseSearch)
    );
    
    setFilteredEmotes(results);
  }, [searchTerm, emotes]);
  
  // Mock function to fetch global emotes - replace with actual API call
  const fetchGlobalEmotes = async () => {
    // In a real implementation, this would be an API call
    // For now, we'll return mock data
    return [
      {
        id: 'global_1',
        code: ':smile:',
        name: 'Smile',
        url: 'https://cdn.example.com/emotes/smile.png',
        width: 28,
        height: 28
      },
      {
        id: 'global_2',
        code: ':lol:',
        name: 'LOL',
        url: 'https://cdn.example.com/emotes/lol.png',
        width: 28,
        height: 28
      },
      {
        id: 'global_3',
        code: ':clap:',
        name: 'Clap',
        url: 'https://cdn.example.com/emotes/clap.png',
        width: 28,
        height: 28
      },
      {
        id: 'global_4',
        code: ':pog:',
        name: 'Pog',
        url: 'https://cdn.example.com/emotes/pog.png',
        width: 28,
        height: 28
      },
      {
        id: 'global_5',
        code: ':love:',
        name: 'Love',
        url: 'https://cdn.example.com/emotes/love.png',
        width: 28,
        height: 28
      }
    ];
  };
  
  // Mock function to fetch tier-specific emotes - replace with actual API call
  const fetchTierEmotes = async (tier) => {
    // In a real implementation, this would be an API call
    // For now, we'll return mock data based on user tier
    const tierEmotes = [];
    
    // Add basic tier emotes (Pro tier and above)
    if (tier === 'pro' || tier === 'maxed') {
      tierEmotes.push(
        {
          id: 'tier_1',
          code: ':pro_cool:',
          name: 'Pro Cool',
          url: 'https://cdn.example.com/emotes/pro_cool.png',
          width: 28,
          height: 28,
          tier: 'pro'
        },
        {
          id: 'tier_2',
          code: ':pro_wow:',
          name: 'Pro Wow',
          url: 'https://cdn.example.com/emotes/pro_wow.png',
          width: 28,
          height: 28,
          tier: 'pro'
        }
      );
    }
    
    // Add maxed tier emotes
    if (tier === 'maxed') {
      tierEmotes.push(
        {
          id: 'tier_3',
          code: ':maxed_fire:',
          name: 'Maxed Fire',
          url: 'https://cdn.example.com/emotes/maxed_fire.png',
          width: 28,
          height: 28,
          tier: 'maxed'
        },
        {
          id: 'tier_4',
          code: ':maxed_king:',
          name: 'Maxed King',
          url: 'https://cdn.example.com/emotes/maxed_king.png',
          width: 28,
          height: 28,
          tier: 'maxed'
        }
      );
    }
    
    return tierEmotes;
  };
  
  // Mock function to fetch channel-specific emotes - replace with actual API call
  const fetchChannelEmotes = async (channelId) => {
    // In a real implementation, this would be an API call
    // For now, we'll return mock data
    return [
      {
        id: `channel_${channelId}_1`,
        code: ':channel_custom:',
        name: 'Channel Custom',
        url: `https://cdn.example.com/channels/${channelId}/emotes/custom.png`,
        width: 28,
        height: 28,
        channelId
      },
      {
        id: `channel_${channelId}_2`,
        code: ':channel_lol:',
        name: 'Channel LOL',
        url: `https://cdn.example.com/channels/${channelId}/emotes/lol.png`,
        width: 28,
        height: 28,
        channelId
      }
    ];
  };
  
  // Get recently used emotes from local storage
  const getRecentEmotes = () => {
    try {
      const recentEmotesJson = localStorage.getItem('clipt_recent_emotes');
      if (recentEmotesJson) {
        return JSON.parse(recentEmotesJson);
      }
    } catch (error) {
      console.error('Error getting recent emotes:', error);
    }
    
    return [];
  };
  
  // Save an emote to recently used
  const saveRecentEmote = useCallback((emote) => {
    try {
      // Get current recent emotes
      const recentEmotes = getRecentEmotes();
      
      // Remove the emote if it already exists
      const filteredEmotes = recentEmotes.filter(e => e.id !== emote.id);
      
      // Add the emote to the beginning
      const updatedEmotes = [emote, ...filteredEmotes].slice(0, 20); // Keep last 20
      
      // Save to local storage
      localStorage.setItem('clipt_recent_emotes', JSON.stringify(updatedEmotes));
      
      // Update state
      setEmotes(prev => ({
        ...prev,
        recent: updatedEmotes
      }));
    } catch (error) {
      console.error('Error saving recent emote:', error);
    }
  }, []);
  
  // Handle emote selection
  const handleEmoteClick = (emote) => {
    setSelectedEmote(emote);
    onSelectEmote(emote);
    saveRecentEmote(emote);
  };
  
  // Get current tab emotes
  const getCurrentEmotes = () => {
    if (searchTerm.trim()) {
      return filteredEmotes;
    }
    
    switch (activeTab) {
      case 'global':
        return emotes.global;
      case 'tier':
        return emotes.tier;
      case 'channel':
        return emotes.channel;
      case 'recent':
      default:
        return emotes.recent;
    }
  };
  
  // Get tab class
  const getTabClass = (tab) => {
    return `emote-picker-tab ${activeTab === tab ? 'active' : ''}`;
  };
  
  return (
    <motion.div 
      className="emote-picker"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
    >
      <div className="emote-picker-header">
        <div className="emote-picker-title">Emotes</div>
        <button className="emote-picker-close" onClick={onClose}>×</button>
      </div>
      
      {/* Search bar */}
      <div className="emote-search" style={{ padding: '10px 15px' }}>
        <input
          type="text"
          placeholder="Search emotes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: 'var(--chat-input-bg)',
            border: '1px solid var(--chat-border)',
            borderRadius: '4px',
            color: 'var(--chat-text)'
          }}
        />
      </div>
      
      {/* Tab navigation */}
      <div className="emote-picker-tabs">
        <div 
          className={getTabClass('recent')}
          onClick={() => setActiveTab('recent')}
        >
          Recent
        </div>
        <div 
          className={getTabClass('global')}
          onClick={() => setActiveTab('global')}
        >
          Global
        </div>
        <div 
          className={getTabClass('tier')}
          onClick={() => setActiveTab('tier')}
        >
          {userTier === 'maxed' ? 'Maxed' : userTier === 'pro' ? 'Pro' : 'Tier'}
        </div>
        {channelId && (
          <div 
            className={getTabClass('channel')}
            onClick={() => setActiveTab('channel')}
          >
            Channel
          </div>
        )}
      </div>
      
      {/* Emote grid */}
      <div className="emote-grid">
        {isLoading ? (
          <div style={{ padding: '20px', textAlign: 'center', width: '100%' }}>
            Loading emotes...
          </div>
        ) : getCurrentEmotes().length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', width: '100%' }}>
            {searchTerm ? 'No emotes found' : 'No emotes available'}
          </div>
        ) : (
          getCurrentEmotes().map(emote => (
            <div 
              key={emote.id}
              className="emote-item"
              onClick={() => handleEmoteClick(emote)}
              title={emote.code}
            >
              <img 
                src={emote.url} 
                alt={emote.code}
                className="emote-image"
              />
            </div>
          ))
        )}
      </div>
      
      {/* Emote preview */}
      <AnimatePresence>
        {selectedEmote && (
          <motion.div 
            className="emote-preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <img 
              src={selectedEmote.url}
              alt={selectedEmote.code}
              className="emote-preview-image"
            />
            <div className="emote-preview-code">{selectedEmote.code}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EmotePicker;
