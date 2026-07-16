import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import WebSocketService from './services/websocketService';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import donationRoutes from './routes/donations';
import storyRoutes from './routes/stories';
import programRoutes from './routes/programs';
import memberRoutes from './routes/members';
import uploadRoutes from './routes/upload';
import statsRoutes from './routes/statsSimple';
import webhookRoutes from './routes/webhooks';
import emailRoutes from './routes/emailRoutes';
import contactMessageRoutes from './routes/contactMessages';
import teamMemberRoutes from './routes/teamMembers';
import newsletterRoutes from './routes/newsletter';
import adminRoutes from './routes/admin';
import eventRoutes from './routes/events';
import volunteerApplicationRoutes from './routes/volunteerApplications';
import organizationStatsRoutes from './routes/organizationStats';
import systemAdminRoutes from './routes/systemAdmin';
import fileStreamRoutes from './routes/fileStream';

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for WebSocket support
const server = createServer(app);

// Initialize WebSocket service
const wsService = new WebSocketService(server);

// Make WebSocket service available globally
export { wsService };

// Trust Railway proxy (fixes rate limiting warning)
app.set('trust proxy', 1);

// Security middleware - CSP completely disabled
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}));

// Explicitly remove any CSP headers that might have been set
app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('Content-Security-Policy-Report-Only');
  next();
});

// CORS configuration - Allow frontend domain
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://hopkinsfoundation.org',
  'https://www.hopkinsfoundation.org'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Remove trailing slash for comparison
    const normalizedOrigin = origin.replace(/\/$/, '');
    const normalizedAllowed = allowedOrigins.map(o => o.replace(/\/$/, ''));
    
    if (normalizedAllowed.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Special rate limiting for donation endpoints
const donationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit donation attempts
  message: {
    error: 'Too many donation attempts, please try again later.',
  },
});

// Body parsing middleware - Increased limits for larger file metadata
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically with proper headers
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
console.log('📁 Upload directory:', UPLOAD_DIR);

// Add streaming endpoint with range request support (takes priority)
// This provides better video streaming than express.static
app.use('/api/files', fileStreamRoutes);

// Add specific middleware for uploaded files with CORS headers
app.use('/api/uploads', (req, res, next) => {
  // Set CORS headers for static files
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
  
  // Set cache headers for better performance
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
  
  // Support Range requests for video streaming
  res.setHeader('Accept-Ranges', 'bytes');
  
  // Log the request for debugging
  console.log('[Static File] Request:', req.method, req.path);
  
  next();
}, express.static(UPLOAD_DIR, {
  // Enable dotfiles, set proper headers
  dotfiles: 'ignore',
  etag: true,
  extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'mov', 'avi', 'webm', 'ogv'],
  index: false,
  maxAge: '1y',
  redirect: false,
  setHeaders: (res, filepath) => {
    console.log('[Static File] Serving:', filepath);
    
    // Set proper MIME types for videos
    const ext = path.extname(filepath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.ogv': 'video/ogg',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  }
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Public endpoint to get hero image settings
const HERO_SETTINGS_FILE = path.join(__dirname, '../uploads/hero-settings.json');
const OUR_STORY_SETTINGS_FILE = path.join(__dirname, '../uploads/our-story-settings.json');

app.get('/api/settings/hero-image', (req, res) => {
  try {
    if (fs.existsSync(HERO_SETTINGS_FILE)) {
      const data = fs.readFileSync(HERO_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      res.json(settings);
    } else {
      // No hero image set yet - return empty
      res.json({ heroImage: null });
    }
  } catch (error) {
    console.error('Error reading hero settings:', error);
    res.json({ heroImage: null });
  }
});

app.get('/api/settings/our-story-image', (req, res) => {
  try {
    if (fs.existsSync(OUR_STORY_SETTINGS_FILE)) {
      const data = fs.readFileSync(OUR_STORY_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      res.json(settings);
    } else {
      // No our story image set yet - return empty
      res.json({ ourStoryImage: null });
    }
  } catch (error) {
    console.error('Error reading our story settings:', error);
    res.json({ ourStoryImage: null });
  }
});

// Debug endpoint to check if file exists
app.get('/api/uploads/debug/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const filePath = path.join(UPLOAD_DIR, folder, filename);
  
  console.log('[Debug] Checking file:', filePath);
  console.log('[Debug] Upload dir:', UPLOAD_DIR);
  
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    res.json({
      exists: true,
      path: filePath,
      size: stats.size,
      url: `/api/uploads/${folder}/${filename}`,
      fullUrl: `${req.protocol}://${req.get('host')}/api/uploads/${folder}/${filename}`
    });
  } else {
    res.status(404).json({
      exists: false,
      path: filePath,
      uploadDir: UPLOAD_DIR,
      message: 'File not found'
    });
  }
});

// Database health check
import { checkDatabaseHealth } from './controllers/dbHealth';
app.get('/api/health/db', checkDatabaseHealth);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/system', systemAdminRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/organization-stats', organizationStatsRoutes);
app.use('/api/donations', donationLimiter, donationRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/contact', contactMessageRoutes);
app.use('/api/team', teamMemberRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/volunteer-applications', volunteerApplicationRoutes);
app.use('/api/webhooks', webhookRoutes);

// 404 handler for non-API routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response) => {
  console.error('Error:', err);

  // Handle different types of errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      message: err.message,
    });
    return;
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
    });
    return;
  }

  if (err.code === 'P2002') {
    res.status(409).json({
      error: 'Conflict',
      message: 'A record with this information already exists',
    });
    return;
  }

  // Default error response
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message,
  });
});

// Import system monitoring service
import systemMonitoringService from './services/systemMonitoringService';

// Start server with WebSocket support
server.listen(PORT, () => {
  console.log(`🚀 NGO Backend Server running on port ${PORT}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`⚡ WebSocket Server ready for real-time updates`);
  
  // Start system monitoring (only if tables exist)
  // This will gracefully handle missing tables during initial deployment
  systemMonitoringService.start().catch((error) => {
    console.warn('⚠️  System monitoring not started - database migrations may need to be applied');
    console.warn('   Run: npx prisma migrate deploy');
  });
  
  // Schedule daily cleanup tasks
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    systemMonitoringService.cleanupOldHealthChecks().catch(() => {});
    systemMonitoringService.cleanupOldActivityLogs().catch(() => {});
  }, TWENTY_FOUR_HOURS);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  systemMonitoringService.stop();
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;