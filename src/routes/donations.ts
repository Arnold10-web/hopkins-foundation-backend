import express from 'express';
import {
  createDonation,
  createPledge,
  getUserDonations,
  getAllDonations,
  getDonationById,
  updateDonation,
  getDonationStats,
} from '../controllers/donations';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @route POST /api/donations/pledge
 * @description Create a donation pledge (no auth required)
 * @access Public
 */
router.post('/pledge', createPledge);

/**
 * @route POST /api/donations
 * @description Create a new donation intent
 * @access Public (can be authenticated or anonymous)
 */
router.post('/', authenticateToken, createDonation);

/**
 * @route GET /api/donations/stats
 * @description Get donation statistics
 * @access Public
 */
router.get('/stats', getDonationStats);

/**
 * @route GET /api/donations/my
 * @description Get user's donations
 * @access Private (requires authentication)
 */
router.get('/my', authenticateToken, getUserDonations);

/**
 * @route GET /api/donations/all
 * @description Get all donations (admin only)
 * @access Private (admin only)
 */
router.get('/all', authenticateToken, requireAdmin, getAllDonations);

/**
 * @route GET /api/donations/:id
 * @description Get specific donation by ID
 * @access Private (own donations or admin)
 */
router.get('/:id', authenticateToken, getDonationById);

/**
 * @route PUT /api/donations/:id
 * @description Update donation (limited fields)
 * @access Private (own donations or admin)
 */
router.put('/:id', authenticateToken, updateDonation);

export default router;