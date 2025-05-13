import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import api from '../../services/api';
import './UserCard.scss';

const UserCard = ({ 
  user, 
  isModerator, 
  onModAction, 
  onClose,
  channelId
}) => {
  const currentUser = useSelector(state => state.auth.user);
  const [isLoading, setIsLoading] = useState(false);
  const [userStats, setUserStats] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showModActions, setShowModActions] = useState(false);
  const [showUserReport, setShowUserReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  
  // Check if viewing own profile
  const isOwnProfile = currentUser && user && currentUser.id === user._id;
  
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };
  
  // Format number with commas
  const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  
  // Load user stats
  useEffect(() => {
    if (user && user._id) {
      fetchUserStats();
      checkFollowStatus();
    }
  }, [user]);
  
  // Fetch user stats
  const fetchUserStats = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/api/users/${user._id}/stats`);
      setUserStats(response.data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      setIsLoading(false);
    }
  };
  
  // Check if current user is following this user
  const checkFollowStatus = async () => {
    if (!currentUser || !user) return;
    
    try {
      const response = await api.get(`/api/users/${currentUser.id}/following/${user._id}`);
      setIsFollowing(response.data.isFollowing);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };
  
  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!currentUser) {
      toast.error('You must be logged in to follow users');
      return;
    }
    
    try {
      if (isFollowing) {
        await api.delete(`/api/users/${currentUser.id}/following/${user._id}`);
        setIsFollowing(false);
        toast.success(`You unfollowed ${user.username}`);
      } else {
        await api.post(`/api/users/${currentUser.id}/following/${user._id}`);
        setIsFollowing(true);
        toast.success(`You are now following ${user.username}`);
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
      toast.error('Failed to update follow status');
    }
  };
  
  // Handle user report submission
  const handleReportSubmit = async () => {
    if (!reportReason) {
      toast.error('Please select a reason for your report');
      return;
    }
    
    try {
      await api.post('/api/reports', {
        reportedUserId: user._id,
        reason: reportReason,
        details: reportDetails,
        channelId
      });
      
      toast.success('Report submitted. Thank you for helping keep Clipt safe.');
      setShowUserReport(false);
      setReportReason('');
      setReportDetails('');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report. Please try again.');
    }
  };
  
  // Get user badge based on subscription tier
  const getUserBadge = () => {
    if (!user) return null;
    
    if (user.subscriptionTier === 'maxed') {
      return (
        <span className="user-card__badge user-card__badge--maxed" title="Maxed Tier Subscriber">
          <i className="fas fa-crown"></i> MAXED
        </span>
      );
    } else if (user.subscriptionTier === 'pro') {
      return (
        <span className="user-card__badge user-card__badge--pro" title="Pro Tier Subscriber">
          <i className="fas fa-star"></i> PRO
        </span>
      );
    } else if (user.isVerified) {
      return (
        <span className="user-card__badge user-card__badge--verified" title="Verified Creator">
          <i className="fas fa-check-circle"></i>
        </span>
      );
    }
    
    return null;
  };
  
  // Render the user report form
  const renderReportForm = () => {
    const reportReasons = [
      'Harassment or bullying',
      'Hate speech or discrimination',
      'Spam or misleading content',
      'Inappropriate content',
      'Threatening behavior',
      'Impersonation',
      'Other'
    ];
    
    return (
      <div className="user-card__report">
        <h4 className="user-card__report-title">Report User</h4>
        <div className="user-card__report-form">
          <div className="user-card__form-group">
            <label className="user-card__label">Reason</label>
            <select
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              className="user-card__select"
            >
              <option value="">Select a reason</option>
              {reportReasons.map(reason => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>
          
          <div className="user-card__form-group">
            <label className="user-card__label">Details (optional)</label>
            <textarea
              value={reportDetails}
              onChange={e => setReportDetails(e.target.value)}
              className="user-card__textarea"
              placeholder="Provide any additional details..."
              rows={3}
            />
          </div>
          
          <div className="user-card__report-actions">
            <button
              className="user-card__button user-card__button--cancel"
              onClick={() => setShowUserReport(false)}
            >
              Cancel
            </button>
            <button
              className="user-card__button user-card__button--report"
              onClick={handleReportSubmit}
              disabled={!reportReason}
            >
              Submit Report
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Render mod actions
  const renderModActions = () => {
    return (
      <div className="user-card__mod-actions">
        <h4 className="user-card__mod-title">Moderator Actions</h4>
        <div className="user-card__mod-buttons">
          <button
            className="user-card__mod-button"
            onClick={() => onModAction('timeout', user._id, { duration: 600 })}
          >
            <i className="fas fa-clock"></i>
            <span>Timeout (10m)</span>
          </button>
          
          <button
            className="user-card__mod-button"
            onClick={() => onModAction('timeout', user._id, { duration: 3600 })}
          >
            <i className="fas fa-hourglass-half"></i>
            <span>Timeout (1h)</span>
          </button>
          
          <button
            className="user-card__mod-button user-card__mod-button--ban"
            onClick={() => onModAction('ban', user._id)}
          >
            <i className="fas fa-ban"></i>
            <span>Ban User</span>
          </button>
        </div>
        
        <div className="user-card__mod-info">
          <p>
            <strong>User ID:</strong> {user._id}
          </p>
          <p>
            <strong>Created:</strong> {formatDate(user.createdAt)}
          </p>
        </div>
      </div>
    );
  };
  
  if (!user) {
    return null;
  }
  
  return (
    <motion.div
      className="user-card"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <div className="user-card__header">
        <button className="user-card__close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="user-card__content">
        <div className="user-card__profile">
          <div className="user-card__avatar">
            <img 
              src={user.avatar || '/assets/images/default-avatar.png'} 
              alt={user.username} 
              className="user-card__avatar-img"
            />
          </div>
          
          <div className="user-card__info">
            <div className="user-card__name-row">
              <h3 className="user-card__username">{user.username}</h3>
              {getUserBadge()}
            </div>
            
            {user.displayName && (
              <div className="user-card__display-name">
                {user.displayName}
              </div>
            )}
            
            <div className="user-card__member-since">
              Member since {formatDate(user.createdAt)}
            </div>
            
            {userStats && (
              <div className="user-card__stats">
                <div className="user-card__stat">
                  <span className="user-card__stat-value">{formatNumber(userStats.followers || 0)}</span>
                  <span className="user-card__stat-label">Followers</span>
                </div>
                
                <div className="user-card__stat">
                  <span className="user-card__stat-value">{formatNumber(userStats.following || 0)}</span>
                  <span className="user-card__stat-label">Following</span>
                </div>
                
                <div className="user-card__stat">
                  <span className="user-card__stat-value">{formatNumber(userStats.clips || 0)}</span>
                  <span className="user-card__stat-label">Clips</span>
                </div>
              </div>
            )}
            
            {user.bio && (
              <div className="user-card__bio">
                {user.bio}
              </div>
            )}
          </div>
        </div>
        
        {!isOwnProfile && (
          <div className="user-card__actions">
            <button
              className={`user-card__button ${isFollowing ? 'user-card__button--following' : 'user-card__button--follow'}`}
              onClick={handleFollowToggle}
            >
              {isFollowing ? (
                <>
                  <i className="fas fa-check"></i> Following
                </>
              ) : (
                <>
                  <i className="fas fa-plus"></i> Follow
                </>
              )}
            </button>
            
            <button
              className="user-card__button user-card__button--message"
              onClick={() => {
                toast.info('Messaging feature coming soon!');
              }}
            >
              <i className="fas fa-envelope"></i> Message
            </button>
            
            <button
              className="user-card__button user-card__button--report"
              onClick={() => setShowUserReport(!showUserReport)}
            >
              <i className="fas fa-flag"></i> Report
            </button>
            
            {isModerator && (
              <button
                className="user-card__button user-card__button--mod"
                onClick={() => setShowModActions(!showModActions)}
              >
                <i className="fas fa-shield-alt"></i> Mod Actions
              </button>
            )}
          </div>
        )}
        
        {showUserReport && renderReportForm()}
        {showModActions && isModerator && renderModActions()}
      </div>
      
      <div className="user-card__footer">
        <a 
          href={`/profile/${user.username}`} 
          className="user-card__profile-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          View Full Profile
        </a>
      </div>
    </motion.div>
  );
};

export default UserCard;
