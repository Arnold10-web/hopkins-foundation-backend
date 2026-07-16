import express from 'express';
import {
  createContactMessage,
  getContactMessages,
  getContactMessageById,
  updateContactMessage,
  deleteContactMessage,
  markMessagesAsRead,
} from '../controllers/contactMessages';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/', createContactMessage);

// Protected routes (admin only)
router.get('/', authenticateToken, getContactMessages);
router.get('/:id', authenticateToken, getContactMessageById);
router.put('/:id', authenticateToken, updateContactMessage);
router.delete('/:id', authenticateToken, deleteContactMessage);
router.post('/mark-read', authenticateToken, markMessagesAsRead);

export default router;