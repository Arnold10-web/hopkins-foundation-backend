import { Request, Response, NextFunction } from 'express';
import { PrismaClient, ActivityLogAction, ActivityLogStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware to automatically log activities
 * Usage: Add to specific routes or globally
 */
export const activityLogger = (action: ActivityLogAction) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original send function
    const originalSend = res.send;

    // Override send to log after response
    res.send = function(data: any) {
      res.send = originalSend; // Restore original send

      // Determine status based on response status code
      let status: ActivityLogStatus;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        status = ActivityLogStatus.SUCCESS;
      } else if (res.statusCode >= 400 && res.statusCode < 500) {
        status = ActivityLogStatus.WARNING;
      } else {
        status = ActivityLogStatus.ERROR;
      }

      // Log activity asynchronously (don't block response)
      logActivity({
        action,
        status,
        resource: extractResource(req),
        resourceId: extractResourceId(req),
        details: extractDetails(req, res),
        userId: req.user?.id,
        userEmail: req.user?.email,
        userName: getUserName(req),
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent')
      }).catch(console.error);

      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Log activity directly (can be called from anywhere)
 */
export async function logActivity(data: {
  action: ActivityLogAction;
  status?: ActivityLogStatus;
  resource?: string;
  resourceId?: string;
  details?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        action: data.action,
        status: data.status || ActivityLogStatus.SUCCESS,
        resource: data.resource,
        resourceId: data.resourceId,
        details: data.details,
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      }
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw - logging should not break the main flow
  }
}

// Helper functions
function extractResource(req: Request): string | undefined {
  const path = req.path;
  const match = path.match(/\/api\/([^/]+)/);
  return match ? match[1] : undefined;
}

function extractResourceId(req: Request): string | undefined {
  return req.params.id || req.body.id || undefined;
}

function extractDetails(req: Request): string | undefined {
  try {
    const details: any = {
      method: req.method,
      path: req.path
    };

    // Add relevant body fields (exclude sensitive data)
    if (req.body && Object.keys(req.body).length > 0) {
      const safeBody = { ...req.body };
      delete safeBody.password;
      delete safeBody.token;
      delete safeBody.secret;
      details.body = safeBody;
    }

    return JSON.stringify(details);
  } catch {
    return undefined;
  }
}

function getUserName(req: Request): string | undefined {
  if (req.user) {
    const user = req.user as any;
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
  }
  return undefined;
}

function getClientIp(req: Request): string | undefined {
  // Check various headers for the real IP (useful behind proxies/load balancers)
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    undefined
  );
}

/**
 * Middleware to log specific actions based on route patterns
 */
export const autoLogActivity = (req: Request, res: Response, next: NextFunction) => {
  const method = req.method;
  const path = req.path;

  let action: ActivityLogAction | null = null;

  // Determine action based on method and path
  if (path.includes('/auth/login')) {
    action = ActivityLogAction.LOGIN;
  } else if (path.includes('/auth/logout')) {
    action = ActivityLogAction.LOGOUT;
  } else if (path.includes('/auth/register')) {
    action = ActivityLogAction.USER_REGISTRATION;
  } else if (path.includes('/auth/reset-password')) {
    action = ActivityLogAction.PASSWORD_RESET;
  } else if (path.includes('/donations') && method === 'POST') {
    action = ActivityLogAction.DONATE;
  } else if (path.includes('/upload') && method === 'POST') {
    action = ActivityLogAction.FILE_UPLOAD;
  } else if (path.includes('/upload') && method === 'DELETE') {
    action = ActivityLogAction.FILE_DELETE;
  } else if (method === 'POST') {
    action = ActivityLogAction.CREATE;
  } else if (method === 'PUT' || method === 'PATCH') {
    action = ActivityLogAction.UPDATE;
  } else if (method === 'DELETE') {
    action = ActivityLogAction.DELETE;
  }

  if (action) {
    activityLogger(action)(req, res, next);
    return;
  }

  next();
};

export default {
  activityLogger,
  logActivity,
  autoLogActivity
};
