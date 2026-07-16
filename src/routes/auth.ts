import express from 'express';
import { register, login, logout, getProfile, updateProfile, changePassword, forgotPassword, resetPassword } from '../controllers/auth';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access Public
 */
router.post('/register', register);

/**
 * @route POST /api/auth/login
 * @description Login user
 * @access Public
 */
router.post('/login', login);

/**
 * @route POST /api/auth/logout
 * @description Logout user (client-side token removal)
 * @access Public
 */
router.post('/logout', logout);

/**
 * @route GET /api/auth/profile
 * @description Get user profile
 * @access Private (requires authentication)
 */
router.get('/profile', authenticateToken, getProfile);

/**
 * @route PUT /api/auth/profile
 * @description Update user profile
 * @access Private (requires authentication)
 */
router.put('/profile', authenticateToken, updateProfile);

/**
 * @route PUT /api/auth/change-password
 * @description Change user password
 * @access Private (requires authentication)
 */
router.put('/change-password', authenticateToken, changePassword);

/**
 * @route POST /api/auth/forgot-password
 * @description Request password reset email
 * @access Public
 */
router.post('/forgot-password', forgotPassword);

/**
 * @route POST /api/auth/reset-password
 * @description Reset password with token
 * @access Public
 */
router.post('/reset-password', resetPassword);

export default router;