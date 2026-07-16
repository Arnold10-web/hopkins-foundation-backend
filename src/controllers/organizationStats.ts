import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database';

// Validation schemas
const CreateStatsSchema = z.object({
  livesTransformed: z.number().min(0),
  programsActive: z.number().min(0),
  countriesServed: z.number().min(0),
  livesChangedGreenSkills: z.number().min(0),
  womenYouthTrained: z.number().min(0),
  communitiesReached: z.number().min(0),
  activeCommunityMembers: z.number().min(0),
  label: z.string().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().optional(),
});

const UpdateStatsSchema = CreateStatsSchema.partial();

// Get active organization stats (public)
export const getActiveStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get the active stats with highest display order
    const stats = await prisma.organizationStats.findFirst({
      where: {
        isActive: true
      },
      orderBy: {
        displayOrder: 'desc'
      }
    });

    // If no stats exist, return zeros instead of creating mock data
    if (!stats) {
      res.status(200).json({
        success: true,
        stats: {
          livesTransformed: 0,
          programsActive: 0,
          countriesServed: 0,
          livesChangedGreenSkills: 0,
          womenYouthTrained: 0,
          communitiesReached: 0,
          activeCommunityMembers: 0,
          label: 'No Stats Yet',
          isActive: false,
          displayOrder: 0
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get active stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get organization stats',
      message: 'Internal server error'
    });
  }
};

// Get all organization stats (admin only)
export const getAllStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await prisma.organizationStats.findMany({
      orderBy: {
        displayOrder: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get all stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
      message: 'Internal server error'
    });
  }
};

// Create new organization stats (admin only)
export const createStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = CreateStatsSchema.parse(req.body);

    // If this is being set as active, deactivate all others
    if (validatedData.isActive) {
      await prisma.organizationStats.updateMany({
        where: {
          isActive: true
        },
        data: {
          isActive: false
        }
      });
    }

    const stats = await prisma.organizationStats.create({
      data: validatedData
    });

    res.status(201).json({
      success: true,
      message: 'Organization stats created successfully',
      stats
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues
      });
      return;
    }

    console.error('Create stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create stats',
      message: 'Internal server error'
    });
  }
};

// Update organization stats (admin only)
export const updateStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const validatedData = UpdateStatsSchema.parse(req.body);

    // If this is being set as active, deactivate all others
    if (validatedData.isActive) {
      await prisma.organizationStats.updateMany({
        where: {
          isActive: true,
          NOT: {
            id
          }
        },
        data: {
          isActive: false
        }
      });
    }

    const stats = await prisma.organizationStats.update({
      where: { id: id as string },
      data: validatedData
    });

    res.status(200).json({
      success: true,
      message: 'Organization stats updated successfully',
      stats
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues
      });
      return;
    }

    console.error('Update stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update stats',
      message: 'Internal server error'
    });
  }
};

// Delete organization stats (admin only)
export const deleteStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    await prisma.organizationStats.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Organization stats deleted successfully'
    });
  } catch (error) {
    console.error('Delete stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete stats',
      message: 'Internal server error'
    });
  }
};

// Get stats by ID (admin only)
export const getStatsById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const stats = await prisma.organizationStats.findUnique({
      where: { id }
    });

    if (!stats) {
      res.status(404).json({
        success: false,
        error: 'Stats not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get stats by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
      message: 'Internal server error'
    });
  }
};
