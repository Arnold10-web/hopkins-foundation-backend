import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  submitApplication,
  getAllApplications,
  getApplicationById,
  updateApplicationStatus,
  deleteApplication,
  getApplicationStats,
  getPublicStats,
} from '../controllers/volunteerApplications';

const router = Router();

// Public routes
router.post('/', submitApplication);
router.get('/public/stats', getPublicStats);

// Admin routes - protected
router.get('/', authenticateToken, getAllApplications);
router.get('/stats', authenticateToken, getApplicationStats);
router.get('/:id', authenticateToken, getApplicationById);
router.put('/:id/status', authenticateToken, updateApplicationStatus);
router.delete('/:id', authenticateToken, deleteApplication);

export default router;
