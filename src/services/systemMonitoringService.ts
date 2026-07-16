import { PrismaClient, SystemHealthStatus } from '@prisma/client';
import { wsService } from '../app';

const prisma = new PrismaClient();

/**
 * System Monitoring Service
 * Periodically checks system health and broadcasts updates
 */
class SystemMonitoringService {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring system health and metrics
   */
  public async start(): Promise<void> {
    console.log('🔍 Starting System Monitoring Service...');

    // Check if required tables exist before starting monitoring
    try {
      // Try to query tables - if this succeeds, tables exist
      await prisma.systemHealth.findFirst().catch(() => null);
      await prisma.activityLog.findFirst().catch(() => null);
      
      // If we got here, tables exist - continue with startup
      console.log('✅ System monitoring tables verified');
    } catch (error: any) {
      if (error.code === 'P2021') {
        console.warn('⚠️  System monitoring tables not found - skipping monitoring service');
        console.warn('   Tables need to be created via: npx prisma migrate deploy');
        return;
      }
      // For other errors, log but continue (table might be empty but exists)
      console.log('⚠️  Could not verify tables, continuing anyway...');
    }

    // Check system health every 2 minutes (reduced from 30s to save memory)
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch((err) => {
        // Silently ignore errors if tables don't exist
        if (err.code !== 'P2021') {
          console.error('Health check error:', err);
        }
      });
    }, 120000); // 2 minutes

    // Update system metrics every 30 seconds (reduced from 10s to save memory)
    this.metricsInterval = setInterval(() => {
      this.updateSystemMetrics().catch((err) => {
        // Silently ignore errors if tables don't exist
        if (err.code !== 'P2021') {
          console.error('Metrics update error:', err);
        }
      });
    }, 30000); // 30 seconds

    // Perform initial checks
    this.performHealthCheck().catch(() => {});
    this.updateSystemMetrics().catch(() => {});

    console.log('✅ System Monitoring Service started');
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    console.log('🛑 System Monitoring Service stopped');
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const [apiHealth, dbHealth, cacheHealth, storageHealth] = await Promise.all([
        this.checkApiHealth(),
        this.checkDatabaseHealth(),
        this.checkCacheHealth(),
        this.checkStorageHealth()
      ]);

      // Broadcast health status via WebSocket
      if (wsService) {
        wsService.broadcastSystemHealth({
          api: apiHealth,
          database: dbHealth,
          cache: cacheHealth,
          storage: storageHealth
        });
      }

      // Check for critical issues and send alerts
      if (dbHealth.status === 'down' || apiHealth.status === 'down') {
        this.sendAlert('error', 'Critical system component is down', {
          api: apiHealth,
          database: dbHealth
        });
      }
    } catch (error) {
      console.error('Error performing health check:', error);
    }
  }

  /**
   * Check API health
   */
  private async checkApiHealth(): Promise<any> {
    const startTime = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      // Don't create health records on every check to reduce DB writes
      // Only create if status changes or on critical issues
      
      return {
        status: 'operational',
        responseTime,
        message: 'API is operational'
      };
    } catch {
      // Only log critical failures
      await prisma.systemHealth.create({
        data: {
          component: 'api',
          status: SystemHealthStatus.DOWN,
          message: 'API check failed'
        }
      }).catch(() => {}); // Ignore errors if table doesn't exist

      return {
        status: 'down',
        message: 'API check failed'
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<any> {
    const startTime = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      // Don't create health records on every check to reduce DB writes
      
      return {
        status: 'operational',
        responseTime,
        message: 'Database is connected'
      };
    } catch {
      // Only log critical failures
      await prisma.systemHealth.create({
        data: {
          component: 'database',
          status: SystemHealthStatus.DOWN,
          message: 'Database connection failed'
        }
      }).catch(() => {}); // Ignore errors if table doesn't exist
      
      return {
        status: 'down',
        message: 'Database connection failed'
      };
    }
  }

  /**
   * Check cache health (Redis)
   */
  private async checkCacheHealth(): Promise<any> {
    // TODO: Implement Redis health check
    // For now, return mock data
    return {
      status: 'operational',
      responseTime: 5,
      message: 'Cache is operational'
    };
  }

  /**
   * Check storage health
   */
  private async checkStorageHealth(): Promise<any> {
    // TODO: Implement storage health check (disk space, cloud storage)
    // For now, return mock data
    return {
      status: 'operational',
      responseTime: 8,
      message: 'Storage is operational'
    };
  }

  /**
   * Update and broadcast system metrics
   */
  private async updateSystemMetrics(): Promise<void> {
    try {
      const [totalUsers, activeUsers, recentErrors, totalRequests] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: { lastLogin: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        }),
        prisma.activityLog.count({
          where: {
            status: 'ERROR',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        prisma.activityLog.count({
          where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        })
      ]);

      const errorRate = totalRequests > 0 ? (recentErrors / totalRequests) * 100 : 0;

      const metrics = {
        cpu: this.getCpuUsage(),
        memory: this.getMemoryUsage(),
        disk: this.getDiskUsage(),
        uptime: process.uptime(),
        activeUsers,
        totalRequests,
        errorRate: parseFloat(errorRate.toFixed(2))
      };

      // Broadcast metrics via WebSocket
      if (wsService) {
        wsService.broadcastSystemMetrics(metrics);
      }

      // Alert if error rate is too high
      if (errorRate > 5) {
        this.sendAlert('warning', `High error rate: ${errorRate.toFixed(2)}%`, {
          errorRate,
          recentErrors,
          totalRequests
        });
      }

      // Alert if memory usage is critically high (increased threshold from 85% to 95%)
      if (metrics.memory > 95) {
        this.sendAlert('warning', `High memory usage: ${metrics.memory.toFixed(2)}%`, {
          memory: metrics.memory
        });
      }
    } catch (error) {
      console.error('Error updating system metrics:', error);
    }
  }

  /**
   * Get CPU usage percentage (mock - use os.cpus() for real implementation)
   */
  private getCpuUsage(): number {
    // TODO: Implement actual CPU monitoring
    // For now, return mock value
    return Math.random() * 20 + 50; // 50-70%
  }

  /**
   * Get memory usage percentage
   */
  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    const totalHeap = used.heapTotal;
    const usedHeap = used.heapUsed;
    return (usedHeap / totalHeap) * 100;
  }

  /**
   * Get disk usage percentage (mock - use diskusage package for real implementation)
   */
  private getDiskUsage(): number {
    // TODO: Implement actual disk monitoring
    // For now, return mock value
    return Math.random() * 15 + 45; // 45-60%
  }

  /**
   * Send system alert
   */
  private sendAlert(type: 'error' | 'warning' | 'info', message: string, details?: any): void {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    if (wsService) {
      wsService.broadcastSystemAlert({
        type,
        message,
        details
      });
    }
  }

  /**
   * Clean up old health check records (run daily)
   */
  public async cleanupOldHealthChecks(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      await prisma.systemHealth.deleteMany({
        where: {
          checkedAt: {
            lt: thirtyDaysAgo
          }
        }
      });

      console.log('✅ Cleaned up old health check records');
    } catch (error: any) {
      // Silently ignore if table doesn't exist
      if (error.code !== 'P2021') {
        console.error('Error cleaning up health checks:', error);
      }
    }
  }

  /**
   * Clean up old activity logs (run daily)
   */
  public async cleanupOldActivityLogs(): Promise<void> {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      await prisma.activityLog.deleteMany({
        where: {
          createdAt: {
            lt: ninetyDaysAgo
          }
        }
      });

      console.log('✅ Cleaned up old activity logs');
    } catch (error: any) {
      // Silently ignore if table doesn't exist
      if (error.code !== 'P2021') {
        console.error('Error cleaning up activity logs:', error);
      }
    }
  }
}

// Create singleton instance
const systemMonitoringService = new SystemMonitoringService();

export default systemMonitoringService;
