import express from 'express';
import { 
  createFirstAdmin, 
  promoteToAdmin,
  getDashboardStats,
  getAllStories,
  getStoryById,
  createStory,
  updateStory,
  deleteStory,
  publishStory,
  getAllPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  getAllUsers,
  getAllDonations,
  getContactMessages,
  markMessageAsRead
} from '../controllers/admin';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// ==================== HERO IMAGE SETTINGS ====================
import fs from 'fs';
import path from 'path';

const HERO_SETTINGS_FILE = path.join(__dirname, '../../uploads/hero-settings.json');
const OUR_STORY_SETTINGS_FILE = path.join(__dirname, '../../uploads/our-story-settings.json');

/**
 * @route POST /api/admin/settings/hero-image
 * @description Save hero background image (admin only)
 * @access Private (admin only)
 */
router.post('/settings/hero-image', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { heroImage } = req.body;
    
    if (!heroImage) {
      return res.status(400).json({ error: 'Hero image URL is required' });
    }

    // Ensure uploads directory exists
    const uploadsDir = path.dirname(HERO_SETTINGS_FILE);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save to simple JSON file
    fs.writeFileSync(HERO_SETTINGS_FILE, JSON.stringify({ heroImage }, null, 2));
    
    return res.json({ success: true, message: 'Hero image saved successfully' });
  } catch (error) {
    console.error('Error saving hero image:', error);
    return res.status(500).json({ error: 'Failed to save hero image' });
  }
});

/**
 * @route POST /api/admin/settings/our-story-image
 * @description Save our story image (admin only)
 * @access Private (admin only)
 */
router.post('/settings/our-story-image', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ourStoryImage } = req.body;
    
    if (!ourStoryImage) {
      return res.status(400).json({ error: 'Our story image URL is required' });
    }

    // Ensure uploads directory exists
    const uploadsDir = path.dirname(OUR_STORY_SETTINGS_FILE);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save to simple JSON file
    fs.writeFileSync(OUR_STORY_SETTINGS_FILE, JSON.stringify({ ourStoryImage }, null, 2));
    
    return res.json({ success: true, message: 'Our story image saved successfully' });
  } catch (error) {
    console.error('Error saving our story image:', error);
    return res.status(500).json({ error: 'Failed to save our story image' });
  }
});

/**
 * @route POST /api/admin/create-first
 * @description Create the first admin user (one-time use)
 * @access Public (but requires secret key)
 * 
 * Body:
 * {
 *   "email": "admin@hopkinsfoundation.org",
 *   "password": "SecurePassword123!",
 *   "firstName": "Admin",
 *   "lastName": "User",
 *   "secretKey": "your-secret-key-from-env"
 * }
 */
router.post('/create-first', createFirstAdmin);

/**
 * @route PUT /api/admin/promote/:userId
 * @description Promote existing user to admin role
 * @access Private (admin only)
 */
router.put('/promote/:userId', authenticateToken, requireAdmin, promoteToAdmin);

// ==================== DASHBOARD ====================

/**
 * @route GET /api/admin/stats
 * @description Get dashboard statistics
 * @access Private (admin only)
 */
router.get('/stats', authenticateToken, requireAdmin, getDashboardStats);

// ==================== STORIES ====================

/**
 * @route GET /api/admin/stories
 * @description Get all stories
 * @access Private (admin only)
 */
router.get('/stories', authenticateToken, requireAdmin, getAllStories);

/**
 * @route GET /api/admin/stories/:id
 * @description Get a single story by ID
 * @access Private (admin only)
 */
router.get('/stories/:id', authenticateToken, requireAdmin, getStoryById);

/**
 * @route POST /api/admin/stories
 * @description Create a new story
 * @access Private (admin only)
 */
router.post('/stories', authenticateToken, requireAdmin, createStory);

/**
 * @route PUT /api/admin/stories/:id
 * @description Update a story
 * @access Private (admin only)
 */
router.put('/stories/:id', authenticateToken, requireAdmin, updateStory);

/**
 * @route DELETE /api/admin/stories/:id
 * @description Delete a story
 * @access Private (admin only)
 */
router.delete('/stories/:id', authenticateToken, requireAdmin, deleteStory);

/**
 * @route PUT /api/admin/stories/:id/publish
 * @description Publish/unpublish a story
 * @access Private (admin only)
 */
router.put('/stories/:id/publish', authenticateToken, requireAdmin, publishStory);

// ==================== PROGRAMS ====================

/**
 * @route GET /api/admin/programs
 * @description Get all programs
 * @access Private (admin only)
 */
router.get('/programs', authenticateToken, requireAdmin, getAllPrograms);

/**
 * @route POST /api/admin/programs
 * @description Create a new program
 * @access Private (admin only)
 */
router.post('/programs', authenticateToken, requireAdmin, createProgram);

/**
 * @route PUT /api/admin/programs/:id
 * @description Update a program
 * @access Private (admin only)
 */
router.put('/programs/:id', authenticateToken, requireAdmin, updateProgram);

/**
 * @route DELETE /api/admin/programs/:id
 * @description Delete a program
 * @access Private (admin only)
 */
router.delete('/programs/:id', authenticateToken, requireAdmin, deleteProgram);

// ==================== USERS ====================

/**
 * @route GET /api/admin/users
 * @description Get all users
 * @access Private (admin only)
 */
router.get('/users', authenticateToken, requireAdmin, getAllUsers);

// ==================== DONATIONS ====================

/**
 * @route GET /api/admin/donations
 * @description Get all donations
 * @access Private (admin only)
 */
router.get('/donations', authenticateToken, requireAdmin, getAllDonations);

// ==================== CONTACT MESSAGES ====================

/**
 * @route GET /api/admin/messages
 * @description Get all contact messages
 * @access Private (admin only)
 */
router.get('/messages', authenticateToken, requireAdmin, getContactMessages);

/**
 * @route PUT /api/admin/messages/:id/read
 * @description Mark message as read
 * @access Private (admin only)
 */
router.put('/messages/:id/read', authenticateToken, requireAdmin, markMessageAsRead);

export default router;
