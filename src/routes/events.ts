import { Router } from 'express';
import {
  getPublicEvents,
  getEventById,
  registerForEvent,
  getAllEventsAdmin,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventRegistrations,
  markAttended,
} from '../controllers/events';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/public', getPublicEvents);
router.get('/:id', getEventById);
router.post('/:id/register', registerForEvent);

// Admin routes (protected)
router.get('/', authenticateToken, getAllEventsAdmin);
router.post('/', authenticateToken, createEvent);
router.put('/:id', authenticateToken, updateEvent);
router.delete('/:id', authenticateToken, deleteEvent);
router.get('/:id/registrations', authenticateToken, getEventRegistrations);
router.put('/registrations/:registrationId/attended', authenticateToken, markAttended);

export default router;
