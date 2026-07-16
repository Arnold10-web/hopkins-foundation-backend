import express from 'express';
import {
  getPrograms,
  getProgramById,
  createProgram,
  updateProgram,
} from '../controllers/programs';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth';

const router = express.Router();

/**
 * @route GET /api/programs
 * @description Get all active programs
 * @access Public
 */
router.get('/', getPrograms);

/**
 * @route GET /api/programs/:id
 * @description Get specific program by ID
 * @access Public
 */
router.get('/:id', optionalAuth, getProgramById);

/**
 * @route POST /api/programs
 * @description Create a new program
 * @access Private (admin only)
 */
router.post('/', authenticateToken, requireAdmin, createProgram);

/**
 * @route PUT /api/programs/:id
 * @description Update program
 * @access Private (admin only)
 */
router.put('/:id', authenticateToken, requireAdmin, updateProgram);

export default router;