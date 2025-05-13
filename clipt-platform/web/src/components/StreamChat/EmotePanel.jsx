import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import './EmotePanel.scss';

const EmotePanel = ({ emotes, recentEmotes, onSelectEmote, onClose }) => {
  const [filter, setFilter] = useState('');
  const [filteredEmotes, setFilteredEmotes] = useState([]);
  const [activeCategory, setActiveCategory] = useState('recent');
  const [categories, setCategories] = useState([]);
  const [categorizedEmotes, setCategorizedEmotes] = useState({});
  const searchInputRef = useRef(null);
  
  // Organize emotes into categories
  useEffect(() => {
    // Extract all unique categories
    const uniqueCategories = new Set();
    
    // Add default categories
    uniqueCategories.add('recent');
    uniqueCategories.add('global');
    uniqueCategories.add('channel');
    
    // Add categories from emotes
    emotes.forEach(emote => {
      if (emote.category) {
        uniqueCategories.add(emote.category);
      }
    });
    
    // Get sorted array of categories
    const sortedCategories = [...uniqueCategories].sort();
    
    // Make sure 'recent' is first
    const finalCategories = sortedCategories.filter(cat => cat !== 'recent');
    finalCategories.unshift('recent');
    
    // Set categories state
    setCategories(finalCategories);
    
    // Categorize emotes
    const categorized = {};
    
    // Set up recent emotes
    categorized.recent = recentEmotes || [];
    
    // Set up other categories
    emotes.forEach(emote => {
      const category = emote.category || (emote.type === 'channel' ? 'channel' : 'global');
      
      if (!categorized[category]) {
        categorized[category] = [];
      }
      
      categorized[category].push(emote);
    });
    
    setCategorizedEmotes(categorized);
  }, [emotes, recentEmotes]);
  
  // Filter emotes based on search
  useEffect(() => {
    if (!filter) {
      setFilteredEmotes([]);
      return;
    }
    
    const lowerFilter = filter.toLowerCase();
    const filtered = emotes.filter(emote => 
      emote.code.toLowerCase().includes(lowerFilter) ||
      emote.name.toLowerCase().includes(lowerFilter)
    );
    
    setFilteredEmotes(filtered);
  }, [filter, emotes]);
  
  // Focus search input when panel is opened
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);
  
  // Handle emote click
  const handleEmoteClick = (emote) => {
    onSelectEmote(emote);
  };
  
  // Handle category change
  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    setFilter('');
  };
  
  // Format category name for display
  const formatCategoryName = (category) => {
    if (category === 'global') return 'Global';
    if (category === 'recent') return 'Recent';
    if (category === 'channel') return 'Channel';
    
    // Capitalize first letter of other categories
    return category.charAt(0).toUpperCase() + category.slice(1);
  };
  
  // Render category tabs
  const renderCategoryTabs = () => {
    return (
      <div className="emote-panel__tabs">
        {categories.map(category => (
          <button
            key={category}
            className={`emote-panel__tab ${activeCategory === category ? 'emote-panel__tab--active' : ''}`}
            onClick={() => handleCategoryChange(category)}
          >
            {formatCategoryName(category)}
            {category === 'recent' && categorizedEmotes.recent && (
              <span className="emote-panel__tab-count">{categorizedEmotes.recent.length}</span>
            )}
          </button>
        ))}
      </div>
    );
  };
  
  // Render emotes grid
  const renderEmotesGrid = () => {
    // If searching, show filtered results
    if (filter) {
      if (filteredEmotes.length === 0) {
        return (
          <div className="emote-panel__empty">
            <p>No emotes found for "{filter}"</p>
          </div>
        );
      }
      
      return (
        <div className="emote-panel__grid">
          {filteredEmotes.map(emote => (
            <motion.div
              key={emote.id}
              className="emote-panel__item"
              onClick={() => handleEmoteClick(emote)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <img 
                src={emote.url} 
                alt={emote.code} 
                className={`emote-panel__emote ${emote.isAnimated ? 'emote-panel__emote--animated' : ''}`}
              />
              <div className="emote-panel__emote-info">
                <span className="emote-panel__emote-code">{emote.code}</span>
              </div>
            </motion.div>
          ))}
        </div>
      );
    }
    
    // Otherwise show current category
    const currentEmotes = categorizedEmotes[activeCategory] || [];
    
    if (currentEmotes.length === 0) {
      return (
        <div className="emote-panel__empty">
          <p>No emotes in this category</p>
        </div>
      );
    }
    
    return (
      <div className="emote-panel__grid">
        {currentEmotes.map(emote => (
          <motion.div
            key={emote.id}
            className="emote-panel__item"
            onClick={() => handleEmoteClick(emote)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <img 
              src={emote.url} 
              alt={emote.code} 
              className={`emote-panel__emote ${emote.isAnimated ? 'emote-panel__emote--animated' : ''}`}
            />
            <div className="emote-panel__emote-info">
              <span className="emote-panel__emote-code">{emote.code}</span>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="emote-panel">
      <div className="emote-panel__header">
        <h3 className="emote-panel__title">Emotes</h3>
        <button className="emote-panel__close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="emote-panel__search">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search emotes..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="emote-panel__search-input"
        />
        {filter && (
          <button
            className="emote-panel__search-clear"
            onClick={() => setFilter('')}
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>
      
      {!filter && renderCategoryTabs()}
      
      <div className="emote-panel__content">
        {renderEmotesGrid()}
      </div>
      
      <div className="emote-panel__footer">
        <p className="emote-panel__count">
          {filter
            ? `${filteredEmotes.length} emotes found`
            : `${(categorizedEmotes[activeCategory] || []).length} emotes`}
        </p>
        
        <a href="#" className="emote-panel__link">
          Submit Custom Emotes
        </a>
      </div>
    </div>
  );
};

export default EmotePanel;
