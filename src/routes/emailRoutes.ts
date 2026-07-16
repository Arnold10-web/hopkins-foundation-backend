import { Router } from 'express';
import { emailController } from '../controllers/emailController';
import { authenticateToken } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for email endpoints
const emailRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 email requests per windowMs
  message: {
    success: false,
    message: 'Too many email requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const testEmailRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit test emails to 5 per hour
  message: {
    success: false,
    message: 'Too many test email requests, please try again later.'
  }
});

// Public email endpoints
router.post('/newsletter/subscribe', emailRateLimit, emailController.subscribeToNewsletter);
router.post('/receipt', emailRateLimit, emailController.sendDonationReceipt);
router.post('/welcome', emailRateLimit, emailController.sendWelcomeEmail);
router.post('/password-reset', emailRateLimit, emailController.sendPasswordResetEmail);
router.post('/verify', emailRateLimit, emailController.sendEmailVerification);

// Test endpoint (useful for development)
router.get('/test', testEmailRateLimit, emailController.testEmailConfiguration);

// Admin-only endpoints (require authentication)
router.post('/newsletter/monthly', authenticateToken, emailController.sendMonthlyNewsletter);

export default router;