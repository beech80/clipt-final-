/**
 * Emote Routes
 * API endpoints for emote management
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const moderatorMiddleware = require('../middleware/moderator');
const Emote = require('../models/Emote');
const EmoteSet = require('../models/EmoteSet');
const Channel = require('../models/Channel');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

// Emote storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/assets/emotes');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `emote_${uniqueId}${ext}`);
  }
});

// File filter to only allow image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Initialize upload
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter
});

/**
 * @route GET /api/emotes/global
 * @desc Get global emotes
 * @access Public
 */
router.get('/global', async (req, res) => {
  try {
    const emotes = await Emote.getGlobalEmotes();
    return res.json(emotes);
  } catch (error) {
    console.error('Error fetching global emotes:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/emotes/tier/:tier
 * @desc Get emotes for a specific subscription tier
 * @access Public
 */
router.get('/tier/:tier', async (req, res) => {
  try {
    const { tier } = req.params;
    
    // Validate tier
    const validTiers = ['pro', 'maxed'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ message: 'Invalid tier' });
    }
    
    const emotes = await Emote.getTierEmotes(tier);
    return res.json(emotes);
  } catch (error) {
    console.error('Error fetching tier emotes:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/emotes/channel/:channelId
 * @desc Get emotes for a specific channel
 * @access Public
 */
router.get('/channel/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    const emotes = await Emote.getChannelEmotes(channelId);
    return res.json(emotes);
  } catch (error) {
    console.error('Error fetching channel emotes:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/emotes/sets
 * @desc Get emote sets
 * @access Public
 */
router.get('/sets', async (req, res) => {
  try {
    const { type, tier } = req.query;
    
    let emoteSets = [];
    
    if (type === 'global') {
      emoteSets = await EmoteSet.getGlobalEmoteSets();
    } else if (type === 'tier' && tier) {
      emoteSets = await EmoteSet.getTierEmoteSets(tier);
    } else if (type === 'featured') {
      emoteSets = await EmoteSet.getFeaturedEmoteSets();
    } else {
      // Get all sets
      const global = await EmoteSet.getGlobalEmoteSets();
      const featured = await EmoteSet.getFeaturedEmoteSets(3);
      emoteSets = [...global, ...featured];
    }
    
    return res.json(emoteSets);
  } catch (error) {
    console.error('Error fetching emote sets:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/emotes/sets/:channelId
 * @desc Get emote sets for a specific channel
 * @access Public
 */
router.get('/sets/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    
    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    const emoteSets = await EmoteSet.getChannelEmoteSets(channelId);
    return res.json(emoteSets);
  } catch (error) {
    console.error('Error fetching channel emote sets:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/emotes/search
 * @desc Search for emotes
 * @access Public
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const emotes = await Emote.searchEmotes(query, parseInt(limit, 10));
    return res.json(emotes);
  } catch (error) {
    console.error('Error searching for emotes:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/emotes/popular
 * @desc Get popular emotes
 * @access Public
 */
router.get('/popular', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const emotes = await Emote.getPopularEmotes(parseInt(limit, 10));
    return res.json(emotes);
  } catch (error) {
    console.error('Error fetching popular emotes:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/emotes
 * @desc Submit a new emote
 * @access Private
 */
router.post('/', [authMiddleware, upload.single('emoteImage')], async (req, res) => {
  try {
    const { name, code, type = 'custom', channelId, tags } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({ message: 'Name and code are required' });
    }
    
    // Validate emote code format
    const codeRegex = /^:[a-zA-Z0-9_]+:$/;
    if (!codeRegex.test(code)) {
      return res.status(400).json({ message: 'Invalid emote code format. Must be in the format :emoteName:' });
    }
    
    // Check if code already exists
    const existingEmote = await Emote.findOne({ code });
    if (existingEmote) {
      return res.status(400).json({ message: 'Emote code already exists' });
    }
    
    // Verify file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'Emote image is required' });
    }
    
    // Check if file is animated (GIF)
    const isAnimated = path.extname(req.file.filename).toLowerCase() === '.gif';
    
    // Get image dimensions
    const image = sharp(req.file.path);
    const metadata = await image.metadata();
    
    // Resize if too large
    if (metadata.width > 112 || metadata.height > 112) {
      await sharp(req.file.path)
        .resize(112, 112, { fit: 'inside' })
        .toFile(req.file.path + '.resized');
      
      // Replace original with resized
      fs.unlinkSync(req.file.path);
      fs.renameSync(req.file.path + '.resized', req.file.path);
    }
    
    // Create emote URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const emoteUrl = `${baseUrl}/assets/emotes/${req.file.filename}`;
    
    // Set emote tier based on user's subscription
    const user = await User.findById(req.user.id);
    const tier = user.subscriptionTier || 'free';
    
    // If this is a channel emote, verify user has permission
    if (type === 'channel' && channelId) {
      const channel = await Channel.findById(channelId);
      
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }
      
      // Only channel owner can add channel emotes
      if (channel.ownerId.toString() !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized to add channel emotes' });
      }
    }
    
    // Parse tags
    const parsedTags = tags ? JSON.parse(tags) : [];
    
    // Submit emote for approval
    const emote = await Emote.submitEmote({
      name,
      code,
      url: emoteUrl,
      type,
      tier,
      channelId: type === 'channel' ? channelId : undefined,
      width: metadata.width,
      height: metadata.height,
      isAnimated,
      createdBy: req.user.id,
      tags: parsedTags
    });
    
    // If user is admin, automatically approve the emote
    if (req.user.isAdmin) {
      await Emote.approveEmote(emote._id, req.user.id);
      emote.approved = true;
    }
    
    return res.json(emote);
  } catch (error) {
    console.error('Error submitting emote:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/emotes/sets
 * @desc Create a new emote set
 * @access Private (Admin or channel owner)
 */
router.post('/sets', authMiddleware, async (req, res) => {
  try {
    const { name, description, type, tier, channelId, emotes, featured, displayOrder, accessRules } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    
    // If this is a channel emote set, verify user has permission
    if (type === 'channel' && channelId) {
      const channel = await Channel.findById(channelId);
      
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }
      
      // Only channel owner can add channel emote sets
      if (channel.ownerId.toString() !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized to add channel emote sets' });
      }
    } else if (!req.user.isAdmin) {
      // Only admins can create global or tier emote sets
      return res.status(403).json({ message: 'Not authorized to create global or tier emote sets' });
    }
    
    // Create emote set
    const emoteSet = await EmoteSet.createEmoteSet({
      name,
      description,
      type: type || 'global',
      tier: tier || 'free',
      channelId: type === 'channel' ? channelId : undefined,
      emotes: emotes || [],
      createdBy: req.user.id,
      featured: featured || false,
      displayOrder: displayOrder || 0,
      accessRules
    });
    
    return res.json(emoteSet);
  } catch (error) {
    console.error('Error creating emote set:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/emotes/sets/:setId/emotes/:emoteId
 * @desc Add an emote to a set
 * @access Private (Admin or channel owner)
 */
router.put('/sets/:setId/emotes/:emoteId', authMiddleware, async (req, res) => {
  try {
    const { setId, emoteId } = req.params;
    
    // Verify emote set exists
    const emoteSet = await EmoteSet.findById(setId);
    if (!emoteSet) {
      return res.status(404).json({ message: 'Emote set not found' });
    }
    
    // Verify emote exists
    const emote = await Emote.findById(emoteId);
    if (!emote) {
      return res.status(404).json({ message: 'Emote not found' });
    }
    
    // Check if user has permission
    if (emoteSet.type === 'channel' && emoteSet.channelId) {
      const channel = await Channel.findById(emoteSet.channelId);
      
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }
      
      // Only channel owner can modify channel emote sets
      if (channel.ownerId.toString() !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized to modify channel emote sets' });
      }
    } else if (!req.user.isAdmin) {
      // Only admins can modify global or tier emote sets
      return res.status(403).json({ message: 'Not authorized to modify global or tier emote sets' });
    }
    
    // Add emote to set
    const success = await EmoteSet.addEmoteToSet(setId, emoteId);
    
    if (!success) {
      return res.status(400).json({ message: 'Failed to add emote to set' });
    }
    
    return res.json({ message: 'Emote added to set successfully' });
  } catch (error) {
    console.error('Error adding emote to set:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route DELETE /api/emotes/sets/:setId/emotes/:emoteId
 * @desc Remove an emote from a set
 * @access Private (Admin or channel owner)
 */
router.delete('/sets/:setId/emotes/:emoteId', authMiddleware, async (req, res) => {
  try {
    const { setId, emoteId } = req.params;
    
    // Verify emote set exists
    const emoteSet = await EmoteSet.findById(setId);
    if (!emoteSet) {
      return res.status(404).json({ message: 'Emote set not found' });
    }
    
    // Check if user has permission
    if (emoteSet.type === 'channel' && emoteSet.channelId) {
      const channel = await Channel.findById(emoteSet.channelId);
      
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }
      
      // Only channel owner can modify channel emote sets
      if (channel.ownerId.toString() !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized to modify channel emote sets' });
      }
    } else if (!req.user.isAdmin) {
      // Only admins can modify global or tier emote sets
      return res.status(403).json({ message: 'Not authorized to modify global or tier emote sets' });
    }
    
    // Remove emote from set
    const success = await EmoteSet.removeEmoteFromSet(setId, emoteId);
    
    if (!success) {
      return res.status(400).json({ message: 'Failed to remove emote from set' });
    }
    
    return res.json({ message: 'Emote removed from set successfully' });
  } catch (error) {
    console.error('Error removing emote from set:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/emotes/:emoteId/approve
 * @desc Approve an emote
 * @access Private (Admin only)
 */
router.put('/:emoteId/approve', [authMiddleware, moderatorMiddleware], async (req, res) => {
  try {
    const { emoteId } = req.params;
    
    // Only admins can approve emotes
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Approve emote
    const emote = await Emote.approveEmote(emoteId, req.user.id);
    
    if (!emote) {
      return res.status(404).json({ message: 'Emote not found' });
    }
    
    return res.json(emote);
  } catch (error) {
    console.error('Error approving emote:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/emotes/:emoteId/reject
 * @desc Reject an emote
 * @access Private (Admin only)
 */
router.put('/:emoteId/reject', [authMiddleware, moderatorMiddleware], async (req, res) => {
  try {
    const { emoteId } = req.params;
    const { reason } = req.body;
    
    // Only admins can reject emotes
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Reject emote
    const emote = await Emote.rejectEmote(emoteId, reason);
    
    if (!emote) {
      return res.status(404).json({ message: 'Emote not found' });
    }
    
    return res.json(emote);
  } catch (error) {
    console.error('Error rejecting emote:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
