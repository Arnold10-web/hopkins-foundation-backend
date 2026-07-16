import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import prisma from '../utils/database';

const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

// Security function to validate and sanitize file paths
const validateFilePath = (basePath: string, filename: string): { isValid: boolean; sanitizedPath: string } => {
  // Remove any path traversal attempts
  const sanitized = filename.replace(/[^a-zA-Z0-9.-_]/g, '');
  
  // Ensure filename is not empty after sanitization
  if (!sanitized || sanitized.length === 0) {
    return { isValid: false, sanitizedPath: '' };
  }
  
  const fullPath = path.join(basePath, sanitized);
  const resolvedPath = path.resolve(fullPath);
  const resolvedBase = path.resolve(basePath);
  
  // Check if the resolved path is within the base directory
  const isValid = resolvedPath.startsWith(resolvedBase + path.sep) || resolvedPath === resolvedBase;
  
  return { isValid, sanitizedPath: isValid ? resolvedPath : '' };
};

// Get the base upload directory from environment or use default
const BASE_UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    console.log('[Multer] Processing file:', file.originalname, 'Field:', file.fieldname);
    let uploadPath = BASE_UPLOAD_DIR + '/';
    
    // Determine if file is video or image
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');
    
    // Create different folders based on file type
    if (file.fieldname === 'avatar' || file.fieldname === 'profileImage') {
      uploadPath += 'avatars/';
    } else if (file.fieldname === 'storyImage' || file.fieldname === 'featuredImage') {
      uploadPath += 'stories/';
    } else if (file.fieldname === 'programImage') {
      uploadPath += 'programs/';
    } else if (file.fieldname === 'teamImage') {
      uploadPath += 'team/';
    } else if (file.fieldname === 'image' || file.fieldname === 'video') {
      // Handle generic 'image' or 'video' field from site assets
      const folder = (req.body.folder || req.query.folder) as string;
      console.log('[Multer] Folder from request:', folder);
      
      if (folder) {
        // Use folder + type subfolder for better organization
        if (isVideo) {
          uploadPath += folder + '/videos/';
        } else if (isImage) {
          uploadPath += folder + '/images/';
        } else {
          uploadPath += folder + '/';
        }
      } else {
        // Default: separate videos and images
        if (isVideo) {
          uploadPath += 'videos/';
        } else if (isImage) {
          uploadPath += 'images/';
        } else {
          uploadPath += 'general/';
        }
      }
    } else {
      // Fallback based on MIME type
      if (isVideo) {
        uploadPath += 'videos/';
      } else if (isImage) {
        uploadPath += 'images/';
      } else {
        uploadPath += 'general/';
      }
    }

    console.log('[Multer] Upload path:', uploadPath);

    // Ensure directory exists
    try {
      await access(uploadPath);
      console.log('[Multer] Directory exists:', uploadPath);
    } catch {
      console.log('[Multer] Creating directory:', uploadPath);
      await mkdir(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp + random suffix
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const fileType = file.mimetype.startsWith('video/') ? 'video' : 
                     file.mimetype.startsWith('image/') ? 'image' : 
                     file.fieldname;
    const name = `${fileType}-${timestamp}-${randomSuffix}${ext}`;
    console.log('[Multer] Generated filename:', name);
    cb(null, name);
  }
});

// File filter for image and video uploads
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/ogg'];
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
  
  if (allowedTypes.includes(file.mimetype)) {
    console.log('[Multer] File type approved:', file.mimetype);
    cb(null, true);
  } else {
    console.error('[Multer] File type rejected:', file.mimetype);
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, GIF images and MP4, MOV, AVI, WebM, OGV videos are allowed.'), false);
  }
};

// Configure multer with limits and filtering
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for videos, 50MB for images
    files: 10, // Maximum 10 files per request - Increased for bulk uploads
  },
});

// Single image upload
export const uploadSingleImage = upload.single('image');

// Single video upload
export const uploadSingleVideo = upload.single('video');

// Flexible upload that accepts either image or video field
export const uploadSingleFile = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

// Multiple images upload
export const uploadMultipleImages = upload.array('images', 5);

// Profile image upload
export const uploadProfileImage = upload.single('avatar');

// Story featured image upload
export const uploadStoryImage = upload.single('storyImage');

// Program image upload
export const uploadProgramImage = upload.single('programImage');

// Team member image upload
export const uploadTeamImage = upload.single('teamImage');

// Handle single image upload
export const handleSingleImageUpload = async (req: Request, res: Response) => {
  try {
    console.log('[Upload] Handling single file upload');
    console.log('[Upload] Request body:', req.body);
    
    // Handle files from upload.fields() middleware
    let file: any = null;
    if ((req as any).files) {
      const files = (req as any).files;
      // Check for either 'image' or 'video' field
      if (files.image && files.image[0]) {
        file = files.image[0];
      } else if (files.video && files.video[0]) {
        file = files.video[0];
      }
    } else if (req.file) {
      // Handle file from upload.single() middleware
      file = req.file;
    }
    
    console.log('[Upload] File info:', file ? {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path
    } : 'No file');
    
    if (!file) {
      console.error('[Upload] No file in request');
      res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a file to upload',
      });
      return;
    }

    // Extract the relative path from the full file path
    // File path is like /app/uploads/general/filename.jpg
    // We need to get 'general/filename.jpg' for the URL
    const relativePath = file.path.replace(BASE_UPLOAD_DIR + '/', '');
    
    // Use /api/files/ for videos (streaming) and /api/uploads/ for images (static)
    const isVideo = file.mimetype.startsWith('video/');
    const fileUrl = isVideo ? `/api/files/${relativePath}` : `/api/uploads/${relativePath}`;
    
    console.log('[Upload] File uploaded successfully');
    console.log('[Upload] File path:', file.path);
    console.log('[Upload] Relative path:', relativePath);
    console.log('[Upload] File URL:', fileUrl);
    console.log('[Upload] Using streaming endpoint:', isVideo);
    
    const fileType = file.mimetype.startsWith('video/') ? 'Video' : 'Image';
    
    res.status(200).json({
      message: `${fileType} uploaded successfully`,
      file: {
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        url: fileUrl,
        path: file.path,
      },
    });
  } catch (error) {
    console.error('[Upload] Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to upload file',
    });
  }
};

// Handle multiple images upload
export const handleMultipleImagesUpload = async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        error: 'No files uploaded',
        message: 'Please select image files to upload',
      });
      return;
    }

    const files = req.files.map((file: any) => {
      const relativePath = file.path.replace(BASE_UPLOAD_DIR + '/', '');
      return {
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        url: `/api/uploads/${relativePath}`,
        path: file.path,
      };
    });

    res.status(200).json({
      message: `${files.length} images uploaded successfully`,
      files,
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to upload images',
    });
  }
};

// Handle profile image upload
export const handleProfileImageUpload = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a profile image to upload',
      });
      return;
    }

    const fileUrl = `/api/uploads/avatars/${req.file.filename}`;

    // Update user profile with new image URL
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        profileImage: fileUrl,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImage: true,
      },
    });

    res.status(200).json({
      message: 'Profile image updated successfully',
      user: updatedUser,
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        url: fileUrl,
      },
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: 'Failed to upload profile image',
    });
  }
};

// Delete uploaded file
export const deleteUploadedFile = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const { filename } = req.params;
    const filenameStr = Array.isArray(filename) ? filename.join('') : filename;

    // Validate and sanitize the file path
    const validation = validateFilePath(BASE_UPLOAD_DIR, filenameStr);
    if (!validation.isValid) {
      res.status(400).json({
        error: 'Invalid file path',
        message: 'File path is not allowed',
      });
      return;
    }

    try {
      await access(validation.sanitizedPath);
      await promisify(fs.unlink)(validation.sanitizedPath);
      
      res.status(200).json({
        message: 'File deleted successfully',
        filename: path.basename(validation.sanitizedPath),
      });
    } catch {
      res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist',
      });
    }
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      error: 'Delete failed',
      message: 'Failed to delete file',
    });
  }
};

// Get uploaded files list (admin only)
export const getUploadedFiles = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const folder = req.query.folder as string || '';
    
    // Validate and sanitize the folder path
    const folderValidation = validateFilePath(BASE_UPLOAD_DIR, folder);
    if (folder && !folderValidation.isValid) {
      res.status(400).json({
        error: 'Invalid folder path',
        message: 'Folder path is not allowed',
      });
      return;
    }

    const uploadPath = folder ? folderValidation.sanitizedPath : path.resolve(BASE_UPLOAD_DIR);

    try {
      // Check if folder exists
      try {
        await access(uploadPath);
      } catch {
        // Folder doesn't exist - create it
        console.log('[Upload] Creating missing folder:', uploadPath);
        await mkdir(uploadPath, { recursive: true });
      }

      const files = await promisify(fs.readdir)(uploadPath);
      
      const fileList = await Promise.all(
        files.map(async (filename) => {
          try {
            // Validate each file path
            const fileValidation = validateFilePath(uploadPath, filename);
            if (!fileValidation.isValid) {
              return null;
            }
            
            const stats = await promisify(fs.stat)(fileValidation.sanitizedPath);
            const sanitizedFilename = path.basename(fileValidation.sanitizedPath);
            
            return {
              filename: sanitizedFilename,
              size: stats.size,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime,
              url: `/api/uploads/${folder ? folder + '/' : ''}${sanitizedFilename}`,
            };
          } catch (err) {
            // Skip files that can't be read
            console.warn('[Upload] Skipping file:', filename, err);
            return null;
          }
        })
      );

      // Filter out null entries
      const validFiles = fileList.filter(file => file !== null);

      res.status(200).json({
        folder: folder || 'root',
        files: validFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        count: validFiles.length,
      });
    } catch (error: any) {
      console.error('Folder access error:', error);
      // Return empty list instead of error for missing folders
      res.status(200).json({
        folder: folder || 'root',
        files: [],
        count: 0,
      });
    }
  } catch (error: any) {
    console.error('Get files error:', error);
    res.status(500).json({
      error: 'Failed to get files',
      message: 'Internal server error',
      details: error.message,
    });
  }
};

// Get file info
export const getFileInfo = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filenameStr = Array.isArray(filename) ? filename.join('') : filename;

    // Validate and sanitize the file path
    const validation = validateFilePath(BASE_UPLOAD_DIR, filenameStr);
    if (!validation.isValid) {
      res.status(400).json({
        error: 'Invalid file path',
        message: 'File path is not allowed',
      });
      return;
    }

    try {
      await access(validation.sanitizedPath);
      const stats = await promisify(fs.stat)(validation.sanitizedPath);
      const sanitizedFilename = path.basename(validation.sanitizedPath);
      
      res.status(200).json({
        filename: sanitizedFilename,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        url: `/api/uploads/${sanitizedFilename}`,
        path: validation.sanitizedPath,
      });
    } catch {
      res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist',
      });
    }
  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({
      error: 'Failed to get file info',
      message: 'Internal server error',
    });
  }
};