import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const stat = promisify(fs.stat);

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

/**
 * Stream a file from filesystem with range request support
 * Adapted from Ishaazi Livestock Services streaming controller
 * Supports video seeking, proper MIME types, and efficient streaming
 */
export const streamFile = async (req: Request, res: Response): Promise<void> => {
  try {
    // Fixed: Explicitly cast params to strings
    const folder = req.params.folder as string;
    const filename = req.params.filename as string;
    
    // Construct file path
    const filePath = path.join(UPLOAD_DIR, folder, filename);
    
    console.log(`[FileStream] Request: ${folder}/${filename}`);
    console.log(`[FileStream] Full path: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`❌ [FileStream] File not found: ${filePath}`);
      res.status(404).json({
        success: false,
        message: 'File not found',
        path: filePath
      });
      return;
    }
    
    // Get file stats
    const stats = await stat(filePath);
    const fileSize = stats.size;
    
    console.log(`✅ [FileStream] File found: ${filename} (${fileSize} bytes)`);
    
    // Determine MIME type
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogv': 'video/ogg',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Set proper headers (CRITICAL for video playback)
    res.set('Content-Type', contentType);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Content-Disposition', 'inline'); // Display in browser
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    
    // Handle range requests (CRITICAL for video seeking)
    const range = req.headers.range;
    
    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      
      console.log(`📹 [FileStream] Range request: ${start}-${end}/${fileSize} (${chunkSize} bytes)`);
      
      // Validate range
      if (start >= fileSize || end >= fileSize) {
        console.log(`❌ [FileStream] Invalid range: ${start}-${end} for file size ${fileSize}`);
        res.status(416).json({
          success: false,
          message: 'Requested range not satisfiable'
        });
        return;
      }
      
      // Send partial content
      res.status(206); // Partial Content
      res.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.set('Content-Length', String(chunkSize));
      
      // Create read stream for the requested range
      const fileStream = fs.createReadStream(filePath, { start, end });
      
      // Handle stream errors
      fileStream.on('error', (error) => {
        console.error(`❌ [FileStream] Stream error for ${filename}:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error streaming file'
          });
        }
      });
      
      fileStream.on('end', () => {
        console.log(`✅ [FileStream] Range chunk sent: ${start}-${end}`);
      });
      
      // Pipe stream to response
      fileStream.pipe(res);
      
    } else {
      // No range request - send full file
      console.log(`📁 [FileStream] Full file request: ${filename} (${fileSize} bytes)`);
      
      res.set('Content-Length', String(fileSize));
      
      // Create read stream for full file
      const fileStream = fs.createReadStream(filePath);
      
      // Handle stream errors
      fileStream.on('error', (error) => {
        console.error(`❌ [FileStream] Stream error for ${filename}:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error streaming file'
          });
        }
      });
      
      fileStream.on('end', () => {
        console.log(`✅ [FileStream] Full file sent successfully`);
      });
      
      // Pipe stream to response
      fileStream.pipe(res);
    }
    
  } catch (error: unknown) {
    console.error('❌ [FileStream] Error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error streaming file',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      });
    }
  }
};