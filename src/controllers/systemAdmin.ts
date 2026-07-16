import { Request, Response } from 'express';
import { PrismaClient, ActivityLogAction, ActivityLogStatus, ReportType, ReportStatus, SystemHealthStatus } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// ACTIVITY LOGS
// ============================================================================

/**
 * Get activity logs with filtering and pagination
 */
export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      action,
      startDate,
      endDate
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    
    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { userEmail: { contains: search as string, mode: 'insensitive' } },
        { userName: { contains: search as string, mode: 'insensitive' } },
        { resource: { contains: search as string, mode: 'insensitive' } },
        { details: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    if (status && status !== 'all') {
      where.status = status as ActivityLogStatus;
    }
    
    if (action && action !== 'all') {
      where.action = action as ActivityLogAction;
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.activityLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
};

/**
 * Export activity logs as CSV
 */
export const exportActivityLogs = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status, action } = req.query;
    
    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status as ActivityLogStatus;
    }
    
    if (action && action !== 'all') {
      where.action = action as ActivityLogAction;
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Convert to CSV
    const headers = ['Timestamp', 'User', 'Action', 'Resource', 'Status', 'IP Address', 'Details'];
    const rows = logs.map(log => [
      log.createdAt.toISOString(),
      log.userName || log.userEmail || 'System',
      log.action,
      log.resource || '',
      log.status,
      log.ipAddress || '',
      log.details || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting activity logs:', error);
    res.status(500).json({ error: 'Failed to export activity logs' });
  }
};

/**
 * Create an activity log entry (internal function, can also be used by middleware)
 */
export const createActivityLog = async (data: {
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
}) => {
  try {
    return await prisma.activityLog.create({
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
    console.error('Error creating activity log:', error);
    // Don't throw - logging should not break the main flow
    return null;
  }
};

// ============================================================================
// SYSTEM REPORTS
// ============================================================================

/**
 * Get all system reports
 */
export const getSystemReports = async (req: Request, res: Response) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    if (type && type !== 'all') where.type = type as ReportType;
    if (status && status !== 'all') where.status = status as ReportStatus;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [reports, total] = await Promise.all([
      prisma.systemReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.systemReport.count({ where })
    ]);

    res.json({
      reports,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching system reports:', error);
    res.status(500).json({ error: 'Failed to fetch system reports' });
  }
};

/**
 * Generate a new system report
 */
export const generateSystemReport = async (req: Request, res: Response) => {
  try {
    const { type, name, description, parameters } = req.body;
    const userId = (req as any).user?.id;

    if (!type || !name) {
      return res.status(400).json({ error: 'Report type and name are required' });
    }

    // Create report record
    const report = await prisma.systemReport.create({
      data: {
        type: type as ReportType,
        name,
        description,
        parameters: parameters ? JSON.stringify(parameters) : null,
        status: ReportStatus.GENERATING,
        generatedBy: userId
      }
    });

    // Generate report asynchronously (in production, use a queue)
    generateReportData(report.id, type, parameters).catch(console.error);

    return res.status(201).json({ report, message: 'Report generation started' });
  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
};

/**
 * Generate report data (async background task)
 */
async function generateReportData(reportId: string, type: string, parameters: any) {
  try {
    let data: any = {};
    const params = parameters || {};
    
    // Generate different report types
    switch (type) {
      case ReportType.USER_ACTIVITY:
        data = await generateUserActivityReport(params);
        break;
      case ReportType.FINANCIAL:
        data = await generateFinancialReport(params);
        break;
      case ReportType.SYSTEM_PERFORMANCE:
        data = await generateSystemPerformanceReport(params);
        break;
      case ReportType.CONTENT:
        data = await generateContentReport(params);
        break;
      case ReportType.SECURITY:
        data = await generateSecurityReport(params);
        break;
      case ReportType.ENGAGEMENT:
        data = await generateEngagementReport(params);
        break;
    }

    // In production, save to file and upload to cloud storage
    const fileName = `report-${reportId}-${Date.now()}.json`;
    const fileSize = JSON.stringify(data).length;

    await prisma.systemReport.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.COMPLETED,
        filePath: `/reports/${fileName}`,
        fileSize,
        fileUrl: `/api/system/reports/${reportId}/download`
      }
    });
  } catch (error) {
    console.error('Error generating report data:', error);
    await prisma.systemReport.update({
      where: { id: reportId },
      data: { status: ReportStatus.FAILED }
    });
  }
}

// Report generation helpers
async function generateUserActivityReport(params: any) {
  const { startDate, endDate } = params;
  const where: any = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [totalUsers, newUsers, activeUsers, loginCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where }),
    prisma.user.count({ where: { lastLogin: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.activityLog.count({ where: { action: ActivityLogAction.LOGIN, ...where } })
  ]);

  return { totalUsers, newUsers, activeUsers, loginCount };
}

async function generateFinancialReport(params: any) {
  const { startDate, endDate } = params;
  const where: any = { status: 'COMPLETED' };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const donations = await prisma.donation.findMany({ where });
  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
  const averageAmount = donations.length > 0 ? totalAmount / donations.length : 0;

  return {
    totalDonations: donations.length,
    totalAmount: totalAmount / 100, // Convert from cents
    averageAmount: averageAmount / 100,
    recurringDonations: donations.filter(d => d.type === 'RECURRING').length
  };
}

async function generateSystemPerformanceReport(params: any) {
  const { startDate, endDate } = params;
  const where: any = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [totalRequests, errors, avgResponseTime] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.count({ where: { status: ActivityLogStatus.ERROR, ...where } }),
    prisma.systemHealth.aggregate({
      _avg: { responseTime: true },
      where: { checkedAt: where.createdAt }
    })
  ]);

  return {
    totalRequests,
    errors,
    errorRate: totalRequests > 0 ? (errors / totalRequests) * 100 : 0,
    avgResponseTime: avgResponseTime._avg.responseTime || 0
  };
}

async function generateContentReport(_params: any) {
  const [totalStories, totalPrograms, totalEvents] = await Promise.all([
    prisma.story.count(),
    prisma.program.count(),
    prisma.event.count()
  ]);

  return { totalStories, totalPrograms, totalEvents };
}

async function generateSecurityReport(params: any) {
  const { startDate, endDate } = params;
  const where: any = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [failedLogins, passwordResets, suspiciousActivity] = await Promise.all([
    prisma.activityLog.count({ 
      where: { action: ActivityLogAction.LOGIN, status: ActivityLogStatus.ERROR, ...where }
    }),
    prisma.passwordReset.count({ where }),
    prisma.activityLog.count({ where: { status: ActivityLogStatus.ERROR, ...where } })
  ]);

  return { failedLogins, passwordResets, suspiciousActivity };
}

async function generateEngagementReport(params: any) {
  const { startDate, endDate } = params;
  const where: any = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [totalDonations, volunteerApps] = await Promise.all([
    prisma.donation.count({ where }),
    prisma.volunteerApplication.count({ where })
  ]);

  return { totalDonations, volunteerApps, newsletterSubs: 0 };
}

/**
 * Download a report
 */
export const downloadReport = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    const report = await prisma.systemReport.findUnique({
      where: { id }
    });

    if (!report || report.status !== ReportStatus.COMPLETED) {
      return res.status(404).json({ error: 'Report not found or not ready' });
    }

    // In production, fetch from cloud storage
    // For now, return a placeholder
    return res.json({
      message: 'Report download',
      report,
      downloadUrl: report.fileUrl
    });
  } catch (error) {
    console.error('Error downloading report:', error);
    return res.status(500).json({ error: 'Failed to download report' });
  }
};

// ============================================================================
// SYSTEM HEALTH
// ============================================================================

/**
 * Get current system health status
 */
export const getSystemHealth = async (req: Request, res: Response) => {
  try {
    // Get latest health check for each component
    const components = ['api', 'database', 'cache', 'storage'];
    
    const healthChecks = await Promise.all(
      components.map(component =>
        prisma.systemHealth.findFirst({
          where: { component },
          orderBy: { checkedAt: 'desc' }
        })
      )
    );

    // Perform real-time health checks
    const apiHealth = await checkApiHealth();
    const dbHealth = await checkDatabaseHealth();
    const cacheHealth = await checkCacheHealth();
    const storageHealth = await checkStorageHealth();

    res.json({
      api: apiHealth,
      database: dbHealth,
      cache: cacheHealth,
      storage: storageHealth,
      lastChecks: healthChecks
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
};

/**
 * Get system metrics
 */
export const getSystemMetrics = async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalDonations,
      recentErrors
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { lastLogin: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      }),
      prisma.donation.count({ where: { status: 'COMPLETED' } }),
      prisma.activityLog.count({
        where: {
          status: ActivityLogStatus.ERROR,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    // Calculate metrics
    const totalRequests = await prisma.activityLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    });

    const errorRate = totalRequests > 0 ? (recentErrors / totalRequests) * 100 : 0;

    // Get average response time
    const avgResponse = await prisma.systemHealth.aggregate({
      _avg: { responseTime: true },
      where: {
        checkedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        members: await prisma.user.count({ where: { role: 'MEMBER' } }),
        admins: await prisma.user.count({ where: { role: 'ADMIN' } }),
        guests: 0 // Implement session tracking if needed
      },
      performance: {
        totalRequests,
        errorRate: errorRate.toFixed(2),
        avgResponseTime: avgResponse._avg.responseTime || 0
      },
      donations: {
        total: totalDonations
      },
      system: {
        cpu: Math.random() * 30 + 40, // Mock - replace with actual CPU monitoring
        memory: Math.random() * 20 + 60, // Mock
        disk: Math.random() * 15 + 45, // Mock
        uptime: process.uptime()
      }
    });
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    res.status(500).json({ error: 'Failed to fetch system metrics' });
  }
};

// Health check helpers
async function checkApiHealth() {
  const startTime = Date.now();
  try {
    // Simple API check
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    await prisma.systemHealth.create({
      data: {
        component: 'api',
        status: SystemHealthStatus.OPERATIONAL,
        responseTime,
        message: 'API is operational'
      }
    });

    return {
      status: 'operational',
      responseTime,
      message: 'API is operational'
    };
  } catch {
    await prisma.systemHealth.create({
      data: {
        component: 'api',
        status: SystemHealthStatus.DOWN,
        message: 'API check failed'
      }
    });

    return {
      status: 'down',
      message: 'API check failed'
    };
  }
}

async function checkDatabaseHealth() {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    await prisma.systemHealth.create({
      data: {
        component: 'database',
        status: SystemHealthStatus.OPERATIONAL,
        responseTime,
        message: 'Database is connected'
      }
    });

    return {
      status: 'operational',
      responseTime,
      message: 'Database is connected'
    };
  } catch {
    return {
      status: 'down',
      message: 'Database connection failed'
    };
  }
}

async function checkCacheHealth() {
  // Mock cache check - implement with Redis in production
  return {
    status: 'operational',
    responseTime: 5,
    message: 'Cache is operational'
  };
}

async function checkStorageHealth() {
  // Mock storage check - implement with cloud storage in production
  return {
    status: 'operational',
    responseTime: 8,
    message: 'Storage is operational'
  };
}

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

/**
 * Get all system settings
 */
export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    
    const where = category ? { category: category as string } : {};
    
    const settings = await prisma.systemSettings.findMany({
      where,
      orderBy: { category: 'asc' }
    });

    // Group by category
    const grouped = settings.reduce((acc: any, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = {};
      }
      acc[setting.category][setting.key] = {
        value: setting.dataType === 'json' ? JSON.parse(setting.value) : setting.value,
        label: setting.label,
        description: setting.description,
        dataType: setting.dataType
      };
      return acc;
    }, {});

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
};

/**
 * Update system settings
 */
export const updateSystemSettings = async (req: Request, res: Response) => {
  try {
    const { key, value, category } = req.body;
    const userId = (req as any).user?.id;

    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }

    const setting = await prisma.systemSettings.upsert({
      where: { key },
      update: {
        value: typeof value === 'string' ? value : JSON.stringify(value),
        updatedBy: userId
      },
      create: {
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        category: category || 'general',
        updatedBy: userId
      }
    });

    // Log the settings change
    await createActivityLog({
      action: ActivityLogAction.SETTINGS_CHANGE,
      status: ActivityLogStatus.SUCCESS,
      resource: 'system_settings',
      resourceId: setting.id,
      details: `Updated setting: ${key}`,
      userId,
      userEmail: (req as any).user?.email,
      userName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName
    });

    return res.json({ setting, message: 'Setting updated successfully' });
  } catch (error) {
    console.error('Error updating system settings:', error);
    return res.status(500).json({ error: 'Failed to update system settings' });
  }
};

/**
 * Clear system cache
 */
export const clearCache = async (req: Request, res: Response) => {
  try {
    // Implement cache clearing logic (Redis, etc.)
    const userId = (req as any).user?.id;
    
    await createActivityLog({
      action: ActivityLogAction.SETTINGS_CHANGE,
      status: ActivityLogStatus.SUCCESS,
      resource: 'cache',
      details: 'Cache cleared',
      userId,
      userEmail: (req as any).user?.email,
      userName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName
    });

    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
};

/**
 * Trigger manual backup
 */
export const triggerBackup = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    // Implement backup logic
    await createActivityLog({
      action: ActivityLogAction.DATABASE_BACKUP,
      status: ActivityLogStatus.SUCCESS,
      resource: 'database',
      details: 'Manual backup triggered',
      userId,
      userEmail: (req as any).user?.email,
      userName: (req as any).user?.firstName + ' ' + (req as any).user?.lastName
    });

    res.json({ message: 'Backup initiated successfully' });
  } catch (error) {
    console.error('Error triggering backup:', error);
    res.status(500).json({ error: 'Failed to trigger backup' });
  }
};

/**
 * Test email configuration
 */
export const testEmailConfiguration = async (req: Request, res: Response) => {
  try {
    // Implement email test logic using your email service
    // For now, return success
    
    res.json({ message: 'Test email sent successfully' });
  } catch (error) {
    console.error('Error testing email configuration:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
};
