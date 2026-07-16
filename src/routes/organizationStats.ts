import express from 'express';
import {
  getActiveStats,
  getAllStats,
  getStatsById,
  createStats,
  updateStats,
  deleteStats
} from '../controllers/organizationStats';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Public route - get active stats
router.get('/active', getActiveStats);

// Admin routes - require authentication and admin role
router.get('/', authenticateToken, requireAdmin, getAllStats);
router.get('/:id', authenticateToken, requireAdmin, getStatsById);
router.post('/', authenticateToken, requireAdmin, createStats);
router.put('/:id', authenticateToken, requireAdmin, updateStats);
router.delete('/:id', authenticateToken, requireAdmin, deleteStats);

export default router;
