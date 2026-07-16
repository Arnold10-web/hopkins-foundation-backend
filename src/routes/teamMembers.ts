import express from 'express';
import {
  createTeamMember,
  getTeamMembers,
  getTeamMemberById,
  updateTeamMember,
  deleteTeamMember,
  updateTeamMemberOrder,
} from '../controllers/teamMembers';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getTeamMembers);
router.get('/:id', getTeamMemberById);

// Protected routes (admin only)
router.post('/', authenticateToken, createTeamMember);
router.put('/:id', authenticateToken, updateTeamMember);
router.delete('/:id', authenticateToken, deleteTeamMember);
router.post('/reorder', authenticateToken, updateTeamMemberOrder);

export default router;