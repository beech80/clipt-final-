import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './ModPanel.scss';

const ModPanel = ({
  channelId,
  channelInfo,
  moderators,
  onModAction,
  onClose
}) => {
  const currentUser = useSelector(state => state.auth.user);
  const [activeTab, setActiveTab] = useState('banned');
  const [bannedUsers, setBannedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatSettings, setChatSettings] = useState({
    slowMode: 0,
    followersOnly: 0,
    subscribersOnly: false,
    emoteOnly: false
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [modActionTarget, setModActionTarget] = useState(null);
  const [showAddModForm, setShowAddModForm] = useState(false);
  const [newModUsername, setNewModUsername] = useState('');
  const [newModPermissions, setNewModPermissions] = useState({
    canTimeout: true,
    canBan: true,
    canDeleteMessages: true,
    canManageMods: false
  });
  const [timeoutDuration, setTimeoutDuration] = useState(600);
  const [banReason, setBanReason] = useState('');
  
  // Check if user is channel owner
  const isOwner = currentUser && channelInfo && currentUser.id === channelInfo.ownerId;
  
  // Load banned users
  useEffect(() => {
    if (channelId) {
      fetchBannedUsers();
    }
  }, [channelId]);
  
  // Load channel settings
  useEffect(() => {
    if (channelId) {
      fetchChannelSettings();
    }
  }, [channelId]);
  
  // Fetch banned users
  const fetchBannedUsers = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/api/chat/banned/${channelId}`);
      setBannedUsers(response.data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching banned users:', error);
      toast.error('Failed to load banned users');
      setIsLoading(false);
    }
  };
  
  // Fetch channel settings
  const fetchChannelSettings = async () => {
    try {
      const response = await api.get(`/api/channels/${channelId}/settings`);
      setChatSettings(response.data.chatSettings || {
        slowMode: 0,
        followersOnly: 0,
        subscribersOnly: false,
        emoteOnly: false
      });
    } catch (error) {
      console.error('Error fetching channel settings:', error);
    }
  };
  
  // Update chat settings
  const updateChatSettings = async (settings) => {
    try {
      await api.put(`/api/channels/${channelId}/settings`, {
        chatSettings: {
          ...chatSettings,
          ...settings
        }
      });
      
      setChatSettings(prev => ({
        ...prev,
        ...settings
      }));
      
      // Emit socket event if needed
      if ('slowMode' in settings) {
        onModAction('slowmode', null, { seconds: settings.slowMode });
      } else if ('followersOnly' in settings) {
        onModAction('followersonly', null, { minutes: settings.followersOnly });
      } else if ('subscribersOnly' in settings) {
        onModAction('subsonly', null, { enabled: settings.subscribersOnly });
      } else if ('emoteOnly' in settings) {
        onModAction('emoteonly', null, { enabled: settings.emoteOnly });
      }
      
      toast.success('Chat settings updated');
    } catch (error) {
      console.error('Error updating chat settings:', error);
      toast.error('Failed to update chat settings');
    }
  };
  
  // Filter users based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredUsers([]);
      return;
    }
    
    const fetchUsers = async () => {
      try {
        const response = await api.get(`/api/users/search?q=${searchTerm}`);
        setFilteredUsers(response.data);
      } catch (error) {
        console.error('Error searching users:', error);
        setFilteredUsers([]);
      }
    };
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      if (searchTerm.length >= 3) {
        fetchUsers();
      } else {
        setFilteredUsers([]);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);
  
  // Handle user ban
  const handleBanUser = async (userId, reason) => {
    try {
      await api.post(`/api/chat/ban/${channelId}`, {
        userId,
        reason: reason || undefined
      });
      
      // Refresh banned users list
      fetchBannedUsers();
      
      // Send mod action
      onModAction('ban', userId, { reason });
      
      toast.success('User banned successfully');
      setModActionTarget(null);
    } catch (error) {
      console.error('Error banning user:', error);
      toast.error('Failed to ban user');
    }
  };
  
  // Handle user unban
  const handleUnbanUser = async (userId) => {
    try {
      await api.delete(`/api/chat/ban/${channelId}/${userId}`);
      
      // Refresh banned users list
      fetchBannedUsers();
      
      // Send mod action
      onModAction('unban', userId);
      
      toast.success('User unbanned successfully');
    } catch (error) {
      console.error('Error unbanning user:', error);
      toast.error('Failed to unban user');
    }
  };
  
  // Handle user timeout
  const handleTimeoutUser = async (userId, username, duration) => {
    try {
      // Send timeout via socket
      onModAction('timeout', userId, { 
        duration, 
        reason: banReason || undefined 
      });
      
      toast.success(`${username} has been timed out for ${duration} seconds`);
      setModActionTarget(null);
    } catch (error) {
      console.error('Error timing out user:', error);
      toast.error('Failed to timeout user');
    }
  };
  
  // Handle add moderator
  const handleAddModerator = async () => {
    if (!newModUsername) {
      toast.error('Please enter a username');
      return;
    }
    
    try {
      // First get user by username
      const userResponse = await api.get(`/api/users/byUsername/${newModUsername}`);
      if (!userResponse.data) {
        toast.error('User not found');
        return;
      }
      
      const userId = userResponse.data._id;
      
      // Add moderator
      const response = await api.post(`/api/chat/moderator/${channelId}`, {
        userId,
        permissions: newModPermissions
      });
      
      // Update moderators list
      const updatedModerators = [...moderators, response.data];
      moderators = updatedModerators; // Update the prop
      
      toast.success(`${newModUsername} is now a moderator`);
      setShowAddModForm(false);
      setNewModUsername('');
    } catch (error) {
      console.error('Error adding moderator:', error);
      toast.error('Failed to add moderator');
    }
  };
  
  // Handle remove moderator
  const handleRemoveModerator = async (userId, username) => {
    try {
      await api.delete(`/api/chat/moderator/${channelId}/${userId}`);
      
      // Update moderators list
      const updatedModerators = moderators.filter(mod => mod.userId !== userId);
      moderators = updatedModerators; // Update the prop
      
      toast.success(`${username} is no longer a moderator`);
    } catch (error) {
      console.error('Error removing moderator:', error);
      toast.error('Failed to remove moderator');
    }
  };
  
  // Clear chat
  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear all chat messages?')) {
      onModAction('clear');
      toast.success('Chat cleared');
    }
  };
  
  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  // Format time duration
  const formatDuration = (seconds) => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} minutes`;
    } else if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)} hours`;
    } else {
      return `${Math.floor(seconds / 86400)} days`;
    }
  };
  
  // Render banned users tab
  const renderBannedUsersTab = () => {
    return (
      <div className="mod-panel__banned">
        {isLoading ? (
          <div className="mod-panel__loading">
            <i className="fas fa-spinner fa-spin"></i> Loading banned users...
          </div>
        ) : bannedUsers.length === 0 ? (
          <div className="mod-panel__empty">
            <p>No banned users</p>
          </div>
        ) : (
          <div className="mod-panel__banned-list">
            {bannedUsers.map(ban => (
              <div key={ban._id} className="mod-panel__banned-item">
                <div className="mod-panel__banned-info">
                  <div className="mod-panel__banned-user">{ban.username}</div>
                  {ban.reason && (
                    <div className="mod-panel__banned-reason">{ban.reason}</div>
                  )}
                  <div className="mod-panel__banned-meta">
                    <span>Banned by: {ban.bannedByUsername}</span>
                    <span>Date: {formatDate(ban.createdAt)}</span>
                  </div>
                </div>
                <div className="mod-panel__banned-actions">
                  <button
                    className="mod-panel__button mod-panel__button--unban"
                    onClick={() => handleUnbanUser(ban.userId)}
                  >
                    Unban
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  // Render moderators tab
  const renderModeratorsTab = () => {
    return (
      <div className="mod-panel__moderators">
        {isOwner && (
          <button
            className="mod-panel__button mod-panel__button--add"
            onClick={() => setShowAddModForm(!showAddModForm)}
          >
            {showAddModForm ? 'Cancel' : 'Add Moderator'}
          </button>
        )}
        
        {showAddModForm && (
          <div className="mod-panel__add-mod">
            <div className="mod-panel__form-group">
              <label className="mod-panel__label">Username</label>
              <input
                type="text"
                value={newModUsername}
                onChange={e => setNewModUsername(e.target.value)}
                className="mod-panel__input"
                placeholder="Enter username"
              />
            </div>
            
            <div className="mod-panel__form-group">
              <label className="mod-panel__label">Permissions</label>
              <div className="mod-panel__permissions">
                <label className="mod-panel__checkbox-label">
                  <input
                    type="checkbox"
                    checked={newModPermissions.canTimeout}
                    onChange={e => setNewModPermissions({
                      ...newModPermissions,
                      canTimeout: e.target.checked
                    })}
                    className="mod-panel__checkbox"
                  />
                  <span>Timeout Users</span>
                </label>
                
                <label className="mod-panel__checkbox-label">
                  <input
                    type="checkbox"
                    checked={newModPermissions.canBan}
                    onChange={e => setNewModPermissions({
                      ...newModPermissions,
                      canBan: e.target.checked
                    })}
                    className="mod-panel__checkbox"
                  />
                  <span>Ban Users</span>
                </label>
                
                <label className="mod-panel__checkbox-label">
                  <input
                    type="checkbox"
                    checked={newModPermissions.canDeleteMessages}
                    onChange={e => setNewModPermissions({
                      ...newModPermissions,
                      canDeleteMessages: e.target.checked
                    })}
                    className="mod-panel__checkbox"
                  />
                  <span>Delete Messages</span>
                </label>
                
                <label className="mod-panel__checkbox-label">
                  <input
                    type="checkbox"
                    checked={newModPermissions.canManageMods}
                    onChange={e => setNewModPermissions({
                      ...newModPermissions,
                      canManageMods: e.target.checked
                    })}
                    className="mod-panel__checkbox"
                  />
                  <span>Manage Moderators</span>
                </label>
              </div>
            </div>
            
            <button
              className="mod-panel__button mod-panel__button--add"
              onClick={handleAddModerator}
            >
              Add Moderator
            </button>
          </div>
        )}
        
        <div className="mod-panel__moderators-list">
          {moderators.length === 0 ? (
            <div className="mod-panel__empty">
              <p>No moderators</p>
            </div>
          ) : (
            moderators.map(mod => (
              <div key={mod._id} className="mod-panel__moderator-item">
                <div className="mod-panel__moderator-info">
                  <div className="mod-panel__moderator-user">{mod.username}</div>
                  <div className="mod-panel__moderator-meta">
                    <span>Added: {formatDate(mod.createdAt)}</span>
                  </div>
                </div>
                {isOwner && mod.userId !== channelInfo.ownerId && (
                  <div className="mod-panel__moderator-actions">
                    <button
                      className="mod-panel__button mod-panel__button--remove"
                      onClick={() => handleRemoveModerator(mod.userId, mod.username)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };
  
  // Render settings tab
  const renderSettingsTab = () => {
    return (
      <div className="mod-panel__settings">
        <div className="mod-panel__setting-group">
          <h4 className="mod-panel__setting-title">Slow Mode</h4>
          <p className="mod-panel__setting-desc">
            Limit how often users can send messages
          </p>
          <div className="mod-panel__setting-controls">
            <select
              value={chatSettings.slowMode}
              onChange={e => updateChatSettings({ slowMode: parseInt(e.target.value) })}
              className="mod-panel__select"
            >
              <option value="0">Off</option>
              <option value="3">3 seconds</option>
              <option value="5">5 seconds</option>
              <option value="10">10 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="120">2 minutes</option>
              <option value="300">5 minutes</option>
            </select>
          </div>
        </div>
        
        <div className="mod-panel__setting-group">
          <h4 className="mod-panel__setting-title">Followers-only Mode</h4>
          <p className="mod-panel__setting-desc">
            Only followers can chat in the channel
          </p>
          <div className="mod-panel__setting-controls">
            <select
              value={chatSettings.followersOnly}
              onChange={e => updateChatSettings({ followersOnly: parseInt(e.target.value) })}
              className="mod-panel__select"
            >
              <option value="0">Off</option>
              <option value="0">All followers</option>
              <option value="10">Following for 10 minutes</option>
              <option value="30">Following for 30 minutes</option>
              <option value="60">Following for 1 hour</option>
              <option value="1440">Following for 1 day</option>
              <option value="10080">Following for 1 week</option>
              <option value="43200">Following for 1 month</option>
            </select>
          </div>
        </div>
        
        <div className="mod-panel__setting-group">
          <h4 className="mod-panel__setting-title">Subscribers-only Mode</h4>
          <p className="mod-panel__setting-desc">
            Only subscribers can chat in the channel
          </p>
          <div className="mod-panel__setting-controls">
            <div className="mod-panel__toggle">
              <label className="mod-panel__toggle-label">
                <input
                  type="checkbox"
                  checked={chatSettings.subscribersOnly}
                  onChange={e => updateChatSettings({ subscribersOnly: e.target.checked })}
                  className="mod-panel__toggle-input"
                />
                <span className="mod-panel__toggle-switch"></span>
                <span className="mod-panel__toggle-text">
                  {chatSettings.subscribersOnly ? 'On' : 'Off'}
                </span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="mod-panel__setting-group">
          <h4 className="mod-panel__setting-title">Emote-only Mode</h4>
          <p className="mod-panel__setting-desc">
            Only emotes can be used in chat messages
          </p>
          <div className="mod-panel__setting-controls">
            <div className="mod-panel__toggle">
              <label className="mod-panel__toggle-label">
                <input
                  type="checkbox"
                  checked={chatSettings.emoteOnly}
                  onChange={e => updateChatSettings({ emoteOnly: e.target.checked })}
                  className="mod-panel__toggle-input"
                />
                <span className="mod-panel__toggle-switch"></span>
                <span className="mod-panel__toggle-text">
                  {chatSettings.emoteOnly ? 'On' : 'Off'}
                </span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="mod-panel__setting-group">
          <h4 className="mod-panel__setting-title">Clear Chat</h4>
          <p className="mod-panel__setting-desc">
            Remove all chat messages for everyone
          </p>
          <div className="mod-panel__setting-controls">
            <button
              className="mod-panel__button mod-panel__button--clear"
              onClick={handleClearChat}
            >
              Clear Chat
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Render user actions tab
  const renderActionsTab = () => {
    return (
      <div className="mod-panel__actions">
        <div className="mod-panel__search">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="mod-panel__search-input"
            placeholder="Search users..."
          />
          {searchTerm && (
            <button
              className="mod-panel__search-clear"
              onClick={() => setSearchTerm('')}
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
        
        <div className="mod-panel__user-list">
          {filteredUsers.length === 0 && searchTerm.length >= 3 ? (
            <div className="mod-panel__empty">
              <p>No users found</p>
            </div>
          ) : (
            filteredUsers.map(user => (
              <div key={user._id} className="mod-panel__user-item">
                <div className="mod-panel__user-info">
                  <div className="mod-panel__user-name">{user.username}</div>
                </div>
                <div className="mod-panel__user-actions">
                  <button
                    className="mod-panel__button mod-panel__button--timeout"
                    onClick={() => setModActionTarget({ 
                      user,
                      action: 'timeout'
                    })}
                  >
                    Timeout
                  </button>
                  <button
                    className="mod-panel__button mod-panel__button--ban"
                    onClick={() => setModActionTarget({ 
                      user,
                      action: 'ban'
                    })}
                  >
                    Ban
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Modal for mod actions */}
        {modActionTarget && (
          <div className="mod-panel__modal-overlay">
            <div className="mod-panel__modal">
              <div className="mod-panel__modal-header">
                <h3 className="mod-panel__modal-title">
                  {modActionTarget.action === 'timeout' ? 'Timeout User' : 'Ban User'}
                </h3>
                <button
                  className="mod-panel__modal-close"
                  onClick={() => setModActionTarget(null)}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="mod-panel__modal-content">
                <p className="mod-panel__modal-user">
                  User: <strong>{modActionTarget.user.username}</strong>
                </p>
                
                {modActionTarget.action === 'timeout' && (
                  <div className="mod-panel__form-group">
                    <label className="mod-panel__label">Duration</label>
                    <select
                      value={timeoutDuration}
                      onChange={e => setTimeoutDuration(parseInt(e.target.value))}
                      className="mod-panel__select"
                    >
                      <option value="60">1 minute</option>
                      <option value="300">5 minutes</option>
                      <option value="600">10 minutes</option>
                      <option value="1800">30 minutes</option>
                      <option value="3600">1 hour</option>
                      <option value="86400">1 day</option>
                      <option value="604800">1 week</option>
                    </select>
                  </div>
                )}
                
                <div className="mod-panel__form-group">
                  <label className="mod-panel__label">Reason (optional)</label>
                  <input
                    type="text"
                    value={banReason}
                    onChange={e => setBanReason(e.target.value)}
                    className="mod-panel__input"
                    placeholder="Enter reason"
                  />
                </div>
              </div>
              
              <div className="mod-panel__modal-footer">
                <button
                  className="mod-panel__button mod-panel__button--cancel"
                  onClick={() => setModActionTarget(null)}
                >
                  Cancel
                </button>
                
                <button
                  className={`mod-panel__button mod-panel__button--${modActionTarget.action}`}
                  onClick={() => {
                    if (modActionTarget.action === 'timeout') {
                      handleTimeoutUser(
                        modActionTarget.user._id,
                        modActionTarget.user.username,
                        timeoutDuration
                      );
                    } else {
                      handleBanUser(modActionTarget.user._id, banReason);
                    }
                  }}
                >
                  {modActionTarget.action === 'timeout' ? 'Timeout' : 'Ban'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="mod-panel">
      <div className="mod-panel__header">
        <h3 className="mod-panel__title">Moderator Controls</h3>
        <button className="mod-panel__close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="mod-panel__tabs">
        <button
          className={`mod-panel__tab ${activeTab === 'banned' ? 'mod-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('banned')}
        >
          <i className="fas fa-ban"></i> Banned Users
        </button>
        <button
          className={`mod-panel__tab ${activeTab === 'moderators' ? 'mod-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('moderators')}
        >
          <i className="fas fa-user-shield"></i> Moderators
        </button>
        <button
          className={`mod-panel__tab ${activeTab === 'settings' ? 'mod-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <i className="fas fa-cog"></i> Chat Settings
        </button>
        <button
          className={`mod-panel__tab ${activeTab === 'actions' ? 'mod-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >
          <i className="fas fa-user-times"></i> User Actions
        </button>
      </div>
      
      <div className="mod-panel__content">
        {activeTab === 'banned' && renderBannedUsersTab()}
        {activeTab === 'moderators' && renderModeratorsTab()}
        {activeTab === 'settings' && renderSettingsTab()}
        {activeTab === 'actions' && renderActionsTab()}
      </div>
    </div>
  );
};

export default ModPanel;
