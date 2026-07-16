import express from 'express';
import { streamFile } from '../controllers/fileStreamController';

const router = express.Router();

/**
 * Stream files from Railway volume with range support
 * Adapted from Ishaazi Livestock Services file streaming
 * 
 * Routes:
 * - /api/files/:folder/:filename (e.g., /api/files/stories/image-123.jpg)
 * - /api/files/:folder/:subfolder/:filename (e.g., /api/files/stories/videos/video-123.mp4)
 */

// Handle nested folders (stories/videos/file.mp4)
router.get('/:folder/:subfolder/:filename', (req, res) => {
  // Combine folder and subfolder
  req.params.folder = `${req.params.folder}/${req.params.subfolder}`;
  streamFile(req, res);
});

// Handle single folder (stories/file.jpg)
router.get('/:folder/:filename', streamFile);

export default router;
