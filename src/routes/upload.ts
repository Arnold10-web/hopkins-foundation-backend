import express from 'express';
import {
  uploadSingleFile,
  uploadMultipleImages,
  uploadProfileImage,
  uploadStoryImage,
  uploadProgramImage,
  uploadTeamImage,
  handleSingleImageUpload,
  handleMultipleImagesUpload,
  handleProfileImageUpload,
  deleteUploadedFile,
  getUploadedFiles,
  getFileInfo,
} from '../controllers/upload';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * @route POST /api/upload/single
 * @description Upload a single image or video file
 * @access Private (requires authentication)
 */
router.post('/single', authenticateToken, (req: any, res: any, next: any) => {
  uploadSingleFile(req, res, (err: any) => {
    if (err) {
      console.error('[Upload Route] Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          error: 'File too large',
          message: 'File size exceeds 500MB limit'
        });
        return;
      }
      if (err.message) {
        res.status(400).json({
          error: 'Upload error',
          message: err.message
        });
        return;
      }
      res.status(500).json({
        error: 'Upload failed',
        message: 'An error occurred during file upload'
      });
      return;
    }
    next();
  });
}, handleSingleImageUpload);

/**
 * @route POST /api/upload/multiple
 * @description Upload multiple images
 * @access Private (requires authentication)
 */
router.post('/multiple', authenticateToken, uploadMultipleImages, handleMultipleImagesUpload);

/**
 * @route POST /api/upload/profile
 * @description Upload profile image and update user profile
 * @access Private (requires authentication)
 */
router.post('/profile', authenticateToken, uploadProfileImage, handleProfileImageUpload);

/**
 * @route POST /api/upload/story
 * @description Upload story featured image
 * @access Private (admin only)
 */
router.post('/story', authenticateToken, requireAdmin, uploadStoryImage, handleSingleImageUpload);

/**
 * @route POST /api/upload/program
 * @description Upload program image
 * @access Private (admin only)
 */
router.post('/program', authenticateToken, requireAdmin, uploadProgramImage, handleSingleImageUpload);

/**
 * @route POST /api/upload/team
 * @description Upload team member image
 * @access Private (admin only)
 */
router.post('/team', authenticateToken, requireAdmin, uploadTeamImage, handleSingleImageUpload);

/**
 * @route GET /api/upload
 * @description Get list of uploaded files (alias for /files)
 * @access Private (admin only)
 */
router.get('/', authenticateToken, requireAdmin, getUploadedFiles);

/**
 * @route GET /api/upload/files
 * @description Get list of uploaded files
 * @access Private (admin only)
 */
router.get('/files', authenticateToken, requireAdmin, getUploadedFiles);

/**
 * @route GET /api/upload/files/:filename
 * @description Get file information
 * @access Private (admin only)
 */
router.get('/files/:filename', authenticateToken, requireAdmin, getFileInfo);

/**
 * @route DELETE /api/upload/files/:filename
 * @description Delete uploaded file
 * @access Private (admin only)
 */
router.delete('/files/:filename', authenticateToken, requireAdmin, deleteUploadedFile);

export default router;