import { Request, Response } from 'express';
import prisma from '../utils/database';

/**
 * Database Health Check Controller
 * Verifies that all required tables exist
 */

export const checkDatabaseHealth = async (req: Request, res: Response) => {
  try {
    const checks = {
      database: false,
      tables: {
        User: false,
        OrganizationStats: false,
        Story: false,
        Program: false,
        Event: false,
      },
      errors: [] as string[]
    };

    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.errors.push('Database connection failed');
    }

    // Check if User table exists
    try {
      await prisma.user.findFirst();
      checks.tables.User = true;
    } catch {
      checks.errors.push('User table missing or inaccessible');
    }

    // Check if OrganizationStats table exists
    try {
      await prisma.organizationStats.findFirst();
      checks.tables.OrganizationStats = true;
    } catch {
      checks.errors.push('OrganizationStats table missing - run migrations');
    }

    // Check if Story table exists
    try {
      await prisma.story.findFirst();
      checks.tables.Story = true;
    } catch {
      checks.errors.push('Story table missing or inaccessible');
    }

    // Check if Program table exists
    try {
      await prisma.program.findFirst();
      checks.tables.Program = true;
    } catch {
      checks.errors.push('Program table missing or inaccessible');
    }

    // Check if Event table exists
    try {
      await prisma.event.findFirst();
      checks.tables.Event = true;
    } catch {
      checks.errors.push('Event table missing or inaccessible');
    }

    const allHealthy = checks.database && Object.values(checks.tables).every(v => v);

    res.status(allHealthy ? 200 : 503).json({
      healthy: allHealthy,
      timestamp: new Date().toISOString(),
      ...checks
    });

  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
