import express from 'express';
import {
  subscribeNewsletter,
  unsubscribeNewsletter,
  getNewsletterSubscribers,
  updateSubscriberPreferences,
  deleteSubscriber,
  sendNewsletter,
} from '../controllers/newsletter';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/subscribe', subscribeNewsletter);
router.post('/unsubscribe', unsubscribeNewsletter);

// Protected routes (admin only)
router.get('/subscribers', authenticateToken, getNewsletterSubscribers);
router.post('/send', authenticateToken, sendNewsletter);
router.put('/subscribers/:email', authenticateToken, updateSubscriberPreferences);
router.delete('/subscribers/:email', authenticateToken, deleteSubscriber);

export default router;