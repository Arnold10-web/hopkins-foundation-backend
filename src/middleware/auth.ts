import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../utils/database';

// Declare global types
// eslint-disable-next-line @typescript-eslint/no-namespace -- standard Express Request augmentation
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

// JWT payload schema
const JWTPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  role: z.string(),
});

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: 'Access denied',
        message: 'No token provided',
      });
      return;
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      res.status(500).json({
        error: 'Server configuration error',
        message: 'JWT secret not configured',
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const validatedPayload = JWTPayloadSchema.parse(decoded);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: validatedPayload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isEmailVerified: true,
      },
    });

    if (!user) {
      res.status(401).json({
        error: 'Access denied',
        message: 'User not found',
      });
      return;
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Access denied',
        message: 'Invalid token',
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Access denied',
        message: 'Token expired',
      });
      return;
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error',
    });
  }
};

// Middleware to check if user is admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(401).json({
      error: 'Access denied',
      message: 'Authentication required',
    });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({
      error: 'Access denied',
      message: 'Admin privileges required',
    });
    return;
  }

  next();
};

// Middleware to check if user has one of the required roles
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Access denied',
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Access denied',
        message: `Required role: ${roles.join(' or ')}`,
      });
      return;
    }

    next();
  };
};

// Alias for authenticateToken
export const authenticate = authenticateToken;

// Middleware to check if user is member or higher
export const requireMember = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(401).json({
      error: 'Access denied',
      message: 'Membership required',
    });
    return;
  }

  next();
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      next();
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const validatedPayload = JWTPayloadSchema.parse(decoded);

    const user = await prisma.user.findUnique({
      where: { id: validatedPayload.userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    }

    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};