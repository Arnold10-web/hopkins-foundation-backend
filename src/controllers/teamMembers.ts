import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database';
import { deleteUploadedFile } from '../utils/fileUtils';

// Validation schemas
const CreateTeamMemberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  position: z.string().min(1, 'Position is required'),
  bio: z.string().optional(),
  image: z.string().optional(),
  email: z.string().email().optional(),
  linkedin: z.string().url().optional(),
  x: z.string().url().optional(),  // Formerly Twitter
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

const UpdateTeamMemberSchema = CreateTeamMemberSchema.partial();

// Get all team members
export const getTeamMembers = async (req: Request, res: Response) => {
  try {
    const active = req.query.active !== 'false'; // Default to active members

    const where: any = {};
    if (active) where.isActive = true;

    const teamMembers = await prisma.teamMember.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    res.status(200).json({ teamMembers });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({
      error: 'Failed to get team members',
      message: 'Internal server error',
    });
  }
};

// Get team member by ID
export const getTeamMemberById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string; // Fixed: explicitly cast to string

    const teamMember = await prisma.teamMember.findUnique({
      where: { id },
    });

    if (!teamMember) {
      res.status(404).json({
        error: 'Team member not found',
        message: 'The requested team member does not exist',
      });
      return;
    }

    // Only show active team members to non-admin users
    if (!teamMember.isActive && req.user?.role !== 'ADMIN') {
      res.status(404).json({
        error: 'Team member not found',
        message: 'The requested team member does not exist',
      });
      return;
    }

    res.status(200).json({ teamMember });
  } catch (error) {
    console.error('Get team member error:', error);
    res.status(500).json({
      error: 'Failed to get team member',
      message: 'Internal server error',
    });
  }
};

// Create team member (admin only)
export const createTeamMember = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const validatedData = CreateTeamMemberSchema.parse(req.body);

    const teamMember = await prisma.teamMember.create({
      data: validatedData,
    });

    res.status(201).json({
      message: 'Team member created successfully',
      teamMember,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Create team member error:', error);
    res.status(500).json({
      error: 'Failed to create team member',
      message: 'Internal server error',
    });
  }
};

// Update team member (admin only)
export const updateTeamMember = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string; // Fixed: explicitly cast to string
    const validatedData = UpdateTeamMemberSchema.parse(req.body);

    const existingTeamMember = await prisma.teamMember.findUnique({
      where: { id },
    });

    if (!existingTeamMember) {
      res.status(404).json({
        error: 'Team member not found',
        message: 'The requested team member does not exist',
      });
      return;
    }

    // Delete old image if a new one is being uploaded
    if (validatedData.image && validatedData.image !== existingTeamMember.image && existingTeamMember.image) {
      await deleteUploadedFile(existingTeamMember.image);
    }

    const updatedTeamMember = await prisma.teamMember.update({
      where: { id },
      data: validatedData,
    });

    res.status(200).json({
      message: 'Team member updated successfully',
      teamMember: updatedTeamMember,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Update team member error:', error);
    res.status(500).json({
      error: 'Failed to update team member',
      message: 'Internal server error',
    });
  }
};

// Delete team member (admin only)
export const deleteTeamMember = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string; // Fixed: explicitly cast to string

    const existingTeamMember = await prisma.teamMember.findUnique({
      where: { id },
    });

    if (!existingTeamMember) {
      res.status(404).json({
        error: 'Team member not found',
        message: 'The requested team member does not exist',
      });
      return;
    }

    // Delete the team member's image file if it exists
    if (existingTeamMember.image) {
      await deleteUploadedFile(existingTeamMember.image);
    }

    // Delete the team member from database
    await prisma.teamMember.delete({
      where: { id },
    });

    res.status(200).json({
      message: 'Team member deleted successfully',
    });
  } catch (error) {
    console.error('Delete team member error:', error);
    res.status(500).json({
      error: 'Failed to delete team member',
      message: 'Internal server error',
    });
  }
};

// Update team members order (admin only)
export const updateTeamMemberOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const { memberOrders } = req.body;

    if (!Array.isArray(memberOrders)) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'memberOrders array is required',
      });
      return;
    }

    // Update each team member's sort order
    const updatePromises = memberOrders.map((item: { id: string; sortOrder: number }) =>
      prisma.teamMember.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      message: 'Team member order updated successfully',
    });
  } catch (error) {
    console.error('Update team member order error:', error);
    res.status(500).json({
      error: 'Failed to update team member order',
      message: 'Internal server error',
    });
  }
};