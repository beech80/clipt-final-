import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './ChatSettings.scss';

const ChatSettings = ({ settings, onSettingsChange, onClose }) => {
  const [localSettings, setLocalSettings] = useState({ ...settings });
  
  // Handle setting changes
  const handleSettingChange = (key, value) => {
    const updatedSettings = { ...localSettings, [key]: value };
    setLocalSettings(updatedSettings);
    onSettingsChange(updatedSettings);
  };
  
  // Handle theme change
  const handleThemeChange = (theme) => {
    handleSettingChange('theme', theme);
  };
  
  // Handle font size change
  const handleFontSizeChange = (size) => {
    handleSettingChange('fontSize', size);
  };
  
  // Toggle setting
  const toggleSetting = (key) => {
    handleSettingChange(key, !localSettings[key]);
  };
  
  return (
    <div className="chat-settings">
      <div className="chat-settings__header">
        <h3>Chat Settings</h3>
        <button className="chat-settings__close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="chat-settings__content">
        <section className="chat-settings__section">
          <h4 className="chat-settings__section-title">Theme</h4>
          <div className="chat-settings__theme-selector">
            {['dark', 'light', 'transparent'].map((theme) => (
              <motion.button
                key={theme}
                className={`chat-settings__theme-option chat-settings__theme-option--${theme} ${
                  localSettings.theme === theme ? 'chat-settings__theme-option--active' : ''
                }`}
                onClick={() => handleThemeChange(theme)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="chat-settings__theme-preview"></div>
                <span className="chat-settings__theme-name">
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </span>
                {localSettings.theme === theme && (
                  <i className="fas fa-check chat-settings__theme-check"></i>
                )}
              </motion.button>
            ))}
          </div>
        </section>
        
        <section className="chat-settings__section">
          <h4 className="chat-settings__section-title">Font Size</h4>
          <div className="chat-settings__font-selector">
            {['small', 'medium', 'large'].map((size) => (
              <motion.button
                key={size}
                className={`chat-settings__font-option ${
                  localSettings.fontSize === size ? 'chat-settings__font-option--active' : ''
                }`}
                onClick={() => handleFontSizeChange(size)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className={`chat-settings__font-preview chat-settings__font-preview--${size}`}>
                  Aa
                </span>
                <span className="chat-settings__font-name">
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </span>
              </motion.button>
            ))}
          </div>
        </section>
        
        <section className="chat-settings__section">
          <h4 className="chat-settings__section-title">Display Options</h4>
          <div className="chat-settings__options">
            <div className="chat-settings__option">
              <label className="chat-settings__label">
                <div className="chat-settings__switch">
                  <input
                    type="checkbox"
                    checked={localSettings.timestamps}
                    onChange={() => toggleSetting('timestamps')}
                    className="chat-settings__checkbox"
                  />
                  <span className="chat-settings__slider"></span>
                </div>
                <span>Show Timestamps</span>
              </label>
            </div>
            
            <div className="chat-settings__option">
              <label className="chat-settings__label">
                <div className="chat-settings__switch">
                  <input
                    type="checkbox"
                    checked={localSettings.animations}
                    onChange={() => toggleSetting('animations')}
                    className="chat-settings__checkbox"
                  />
                  <span className="chat-settings__slider"></span>
                </div>
                <span>Enable Animations</span>
              </label>
            </div>
            
            <div className="chat-settings__option">
              <label className="chat-settings__label">
                <div className="chat-settings__switch">
                  <input
                    type="checkbox"
                    checked={localSettings.sounds}
                    onChange={() => toggleSetting('sounds')}
                    className="chat-settings__checkbox"
                  />
                  <span className="chat-settings__slider"></span>
                </div>
                <span>Enable Sounds</span>
              </label>
            </div>
            
            <div className="chat-settings__option">
              <label className="chat-settings__label">
                <div className="chat-settings__switch">
                  <input
                    type="checkbox"
                    checked={localSettings.coloredNames}
                    onChange={() => toggleSetting('coloredNames')}
                    className="chat-settings__checkbox"
                  />
                  <span className="chat-settings__slider"></span>
                </div>
                <span>Colored Usernames</span>
              </label>
            </div>
          </div>
        </section>
        
        <section className="chat-settings__section">
          <h4 className="chat-settings__section-title">Advanced</h4>
          <div className="chat-settings__advanced">
            <button className="chat-settings__button chat-settings__button--clear">
              Clear Chat History
            </button>
            
            <button className="chat-settings__button chat-settings__button--reset" onClick={() => {
              // Reset to defaults
              const defaults = {
                timestamps: true,
                animations: true,
                sounds: true,
                coloredNames: true,
                fontSize: 'medium',
                theme: 'dark'
              };
              setLocalSettings(defaults);
              onSettingsChange(defaults);
            }}>
              Reset to Defaults
            </button>
          </div>
        </section>
      </div>
      
      <div className="chat-settings__footer">
        <p className="chat-settings__info">
          Settings are automatically saved and will persist between sessions.
        </p>
      </div>
    </div>
  );
};

export default ChatSettings;
