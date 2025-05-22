/**
 * Chat Routes
 * API endpoints for chat-related functionality
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const ChatMessage = require('../models/ChatMessage');
const ChannelBan = require('../models/ChannelBan');
const ChannelModerator = require('../models/ChannelModerator');
const Donation = require('../models/Donation');
const User = require('../models/User');
const Channel = require('../models/Channel');

/**
 * @route GET /api/chat/messages/:channelId
 * @desc Get chat messages for a channel
 * @access Public
 */
router.get('/messages/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 50, before } = req.query;
    
    const parsedLimit = parseInt(limit, 10);
    const beforeDate = before ? new Date(parseInt(before, 10)) : null;
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Get messages
    const messages = await ChatMessage.getRoomMessages(
      channelId,
      Math.min(parsedLimit, 100), // Cap limit to 100
      beforeDate
    );
    
    return res.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/chat/donations/:channelId
 * @desc Get donation history for a channel
 * @access Public
 */
router.get('/donations/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 50 } = req.query;
    
    const parsedLimit = parseInt(limit, 10);
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Get donations
    const donations = await Donation.getChannelDonations(
      channelId,
      Math.min(parsedLimit, 100) // Cap limit to 100
    );
    
    return res.json(donations);
  } catch (error) {
    console.error('Error fetching donations:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/chat/top-donors/:channelId
 * @desc Get top donors for a channel
 * @access Public
 */
router.get('/top-donors/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 10 } = req.query;
    
    const parsedLimit = parseInt(limit, 10);
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Get top donors
    const topDonors = await Donation.getChannelTopDonors(
      channelId,
      Math.min(parsedLimit, 20) // Cap limit to 20
    );
    
    return res.json(topDonors);
  } catch (error) {
    console.error('Error fetching top donors:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/chat/banned/:channelId
 * @desc Get banned users for a channel
 * @access Private (Moderators only)
 */
router.get('/banned/:channelId', authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.params;
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Check if user has permission
    const isModerator = await ChannelModerator.isUserModerator(channelId, req.user.id);
    const isOwner = channel.ownerId.toString() === req.user.id;
    const isAdmin = req.user.isAdmin;
    
    if (!isModerator && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Get banned users
    const bannedUsers = await ChannelBan.getChannelBans(channelId);
    
    return res.json(bannedUsers);
  } catch (error) {
    console.error('Error fetching banned users:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/chat/ban/:channelId
 * @desc Ban a user from a channel
 * @access Private (Moderators only)
 */
router.post('/ban/:channelId', authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId, reason, expireAt } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Check if user has permission
    const isModerator = await ChannelModerator.isUserModerator(channelId, req.user.id);
    const isOwner = channel.ownerId.toString() === req.user.id;
    const isAdmin = req.user.isAdmin;
    
    if (!isModerator && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Don't allow banning channel owner
    if (channel.ownerId.toString() === userId) {
      return res.status(400).json({ message: 'Cannot ban channel owner' });
    }
    
    // Check if target is a moderator (only channel owner and admins can ban mods)
    const targetIsMod = await ChannelModerator.isUserModerator(channelId, userId);
    if (targetIsMod && !isOwner && !isAdmin) {
      return res.status(400).json({ message: 'Cannot ban a moderator' });
    }
    
    // Ban user
    const ban = await ChannelBan.banUser(
      channelId,
      userId,
      req.user.id,
      reason,
      expireAt
    );
    
    return res.json(ban);
  } catch (error) {
    console.error('Error banning user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route DELETE /api/chat/ban/:channelId/:userId
 * @desc Unban a user from a channel
 * @access Private (Moderators only)
 */
router.delete('/ban/:channelId/:userId', authMiddleware, async (req, res) => {
  try {
    const { channelId, userId } = req.params;
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Check if user has permission
    const isModerator = await ChannelModerator.isUserModerator(channelId, req.user.id);
    const isOwner = channel.ownerId.toString() === req.user.id;
    const isAdmin = req.user.isAdmin;
    
    if (!isModerator && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Unban user
    const success = await ChannelBan.unbanUser(channelId, userId);
    
    if (!success) {
      return res.status(404).json({ message: 'Ban not found' });
    }
    
    return res.json({ message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Error unbanning user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/chat/moderators/:channelId
 * @desc Get moderators for a channel
 * @access Public
 */
router.get('/moderators/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Get moderators
    const moderators = await ChannelModerator.getChannelModerators(channelId);
    
    return res.json(moderators);
  } catch (error) {
    console.error('Error fetching moderators:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/chat/moderator/:channelId
 * @desc Add a moderator to a channel
 * @access Private (Channel owner only)
 */
router.post('/moderator/:channelId', authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId, permissions } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Check if user has permission (only channel owner or admin)
    const isOwner = channel.ownerId.toString() === req.user.id;
    const isAdmin = req.user.isAdmin;
    
    // Check if user has mod manager permission
    const userMod = await ChannelModerator.findOne({
      channelId,
      userId: req.user.id,
      active: true
    });
    
    const canManageMods = userMod?.permissions?.canManageMods || false;
    
    if (!isOwner && !isAdmin && !canManageMods) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Add moderator
    const moderator = await ChannelModerator.addModerator(
      channelId,
      userId,
      req.user.id,
      permissions
    );
    
    return res.json(moderator);
  } catch (error) {
    console.error('Error adding moderator:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route DELETE /api/chat/moderator/:channelId/:userId
 * @desc Remove a moderator from a channel
 * @access Private (Channel owner only)
 */
router.delete('/moderator/:channelId/:userId', authMiddleware, async (req, res) => {
  try {
    const { channelId, userId } = req.params;
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Check if user has permission (only channel owner or admin)
    const isOwner = channel.ownerId.toString() === req.user.id;
    const isAdmin = req.user.isAdmin;
    
    // Check if user has mod manager permission
    const userMod = await ChannelModerator.findOne({
      channelId,
      userId: req.user.id,
      active: true
    });
    
    const canManageMods = userMod?.permissions?.canManageMods || false;
    
    if (!isOwner && !isAdmin && !canManageMods) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Remove moderator
    const success = await ChannelModerator.removeModerator(channelId, userId);
    
    if (!success) {
      return res.status(404).json({ message: 'Moderator not found' });
    }
    
    return res.json({ message: 'Moderator removed successfully' });
  } catch (error) {
    console.error('Error removing moderator:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/chat/moderator/:channelId/:userId
 * @desc Update moderator permissions
 * @access Private (Channel owner only)
 */
router.put('/moderator/:channelId/:userId', authMiddleware, async (req, res) => {
  try {
    const { channelId, userId } = req.params;
    const { permissions } = req.body;
    
    if (!permissions) {
      return res.status(400).json({ message: 'Permissions are required' });
    }
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Check if user has permission (only channel owner or admin)
    const isOwner = channel.ownerId.toString() === req.user.id;
    const isAdmin = req.user.isAdmin;
    
    // Check if user has mod manager permission
    const userMod = await ChannelModerator.findOne({
      channelId,
      userId: req.user.id,
      active: true
    });
    
    const canManageMods = userMod?.permissions?.canManageMods || false;
    
    if (!isOwner && !isAdmin && !canManageMods) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Update moderator permissions
    const updatedMod = await ChannelModerator.updatePermissions(
      channelId,
      userId,
      permissions
    );
    
    if (!updatedMod) {
      return res.status(404).json({ message: 'Moderator not found' });
    }
    
    return res.json(updatedMod);
  } catch (error) {
    console.error('Error updating moderator permissions:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
