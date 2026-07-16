import express from 'express';
import {
  getMemberDashboard,
  getMemberContentById,
  getMemberActivity,
} from '../controllers/members';
import { authenticateToken, requireMember } from '../middleware/auth';

const router = express.Router();

/**
 * @route GET /api/members/dashboard
 * @description Get member dashboard with stats and recent activity
 * @access Private (requires member authentication)
 */
router.get('/dashboard', authenticateToken, requireMember, getMemberDashboard);

/**
 * @route GET /api/members/content/:id
 * @description Get specific member content by ID with access tracking
 * @access Private (requires member authentication)
 */
router.get('/content/:id', authenticateToken, requireMember, getMemberContentById);

/**
 * @route GET /api/members/activity
 * @description Get member activity and engagement history
 * @access Private (requires member authentication)
 */
router.get('/activity', authenticateToken, requireMember, getMemberActivity);

export default router;