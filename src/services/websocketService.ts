import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

class WebSocketService {
  private io: SocketIOServer;

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Frontend live-feed rooms (join:room / leave:room) were removed during
      // the $0-cost API-only refactor — only system-admin real-time monitoring
      // remains. The connection is currently used solely for admin broadcasts.

      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });
    });
  }

  // Get Socket.IO instance for external use (system-admin broadcasts)
  public getIO(): SocketIOServer {
    return this.io;
  }

  // ========================================================================
  // SYSTEM ADMIN REAL-TIME MONITORING
  // ========================================================================

  /**
   * Broadcast system health update to system admin clients
   */
  public broadcastSystemHealth(health: {
    api: any;
    database: any;
    cache: any;
    storage: any;
  }): void {
    this.io.to('system-admin').emit('system:health', {
      ...health,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast system metrics update
   */
  public broadcastSystemMetrics(metrics: {
    cpu: number;
    memory: number;
    disk: number;
    uptime: number;
    activeUsers: number;
    totalRequests: number;
    errorRate: number;
  }): void {
    this.io.to('system-admin').emit('system:metrics', {
      ...metrics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast new activity log to system admin clients
   */
  public broadcastActivityLog(log: {
    action: string;
    status: string;
    resource?: string;
    userEmail?: string;
    timestamp: Date;
  }): void {
    this.io.to('system-admin').emit('activity:log', {
      ...log,
      timestamp: log.timestamp.toISOString()
    });
  }

  /**
   * Broadcast system alert to system admin clients
   */
  public broadcastSystemAlert(alert: {
    type: 'error' | 'warning' | 'info';
    message: string;
    details?: any;
  }): void {
    this.io.to('system-admin').emit('system:alert', {
      ...alert,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast report generation status
   */
  public broadcastReportStatus(reportData: {
    id: string;
    type: string;
    status: string;
    message?: string;
  }): void {
    this.io.to('system-admin').emit('report:status', {
      ...reportData,
      timestamp: new Date().toISOString()
    });
  }
}

export default WebSocketService;