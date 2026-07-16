import express from 'express';
import authRoutes from './auth';
import adminRoutes from './admin';
import donationRoutes from './donations';
import storyRoutes from './stories';
import programRoutes from './programs';
import statsRoutes from './statsSimple';
import webhookRoutes from './webhooks';
import memberRoutes from './members';
import uploadRoutes from './upload';
import teamMemberRoutes from './teamMembers';
import newsletterRoutes from './newsletter';
import contactMessageRoutes from './contactMessages';
import volunteerApplicationRoutes from './volunteerApplications';
import eventRoutes from './events';

console.log('🔄 statsRoutes imported:', typeof statsRoutes); // Debug import

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'NGO Website API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/stats', statsRoutes);
router.use('/donations', donationRoutes);
router.use('/stories', storyRoutes);
router.use('/programs', programRoutes);
router.use('/events', eventRoutes);
router.use('/members', memberRoutes);
router.use('/upload', uploadRoutes);
router.use('/team', teamMemberRoutes);
router.use('/newsletter', newsletterRoutes);
router.use('/contact', contactMessageRoutes);
router.use('/volunteer-applications', volunteerApplicationRoutes);
router.use('/webhooks', webhookRoutes);

console.log('🔄 All routes registered, including /stats'); // Debug log

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
  });
});

export default router;