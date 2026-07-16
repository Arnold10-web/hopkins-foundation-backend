import express from 'express';
import {
  getStories,
  getStoryById,
  createStory,
  updateStory,
  deleteStory,
  getFeaturedStories,
} from '../controllers/stories';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth';

const router = express.Router();

/**
 * @route GET /api/stories
 * @description Get all published stories with pagination and filtering (member content gated)
 * @access Public with optional authentication for member content
 */
router.get('/', optionalAuth, getStories);

/**
 * @route GET /api/stories/featured
 * @description Get featured stories
 * @access Public
 */
router.get('/featured', getFeaturedStories);

/**
 * @route GET /api/stories/:id
 * @description Get specific story by ID
 * @access Public (published stories) / Admin (all stories)
 */
router.get('/:id', optionalAuth, getStoryById);

/**
 * @route POST /api/stories
 * @description Create a new story
 * @access Private (admin only)
 */
router.post('/', authenticateToken, requireAdmin, createStory);

/**
 * @route PUT /api/stories/:id
 * @description Update story
 * @access Private (admin only)
 */
router.put('/:id', authenticateToken, requireAdmin, updateStory);

/**
 * @route DELETE /api/stories/:id
 * @description Delete story
 * @access Private (admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, deleteStory);

export default router;