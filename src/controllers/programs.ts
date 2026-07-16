import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database';
import { deleteUploadedFiles } from '../utils/fileUtils';

// Validation schemas
const CreateProgramSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  shortDescription: z.string().optional(),
  slug: z.string().min(1, 'Slug is required'),
  featuredImage: z.string().optional(),
  featuredVideo: z.string().optional(),
  impact: z.string().optional(),
  location: z.string().optional(),
  targetGroup: z.string().optional(),
  isActive: z.boolean().default(true),
  beneficiaries: z.number().optional(),
  duration: z.string().optional(),
  budget: z.number().optional(),
  features: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
});

const UpdateProgramSchema = CreateProgramSchema.partial();

// Get all programs
export const getPrograms = async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;
    const active = req.query.active !== 'false'; // Default to active programs

    const where: any = {};
    if (category) where.category = category;
    if (active) where.isActive = true;

    const programs = await prisma.program.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ programs });
  } catch (error) {
    console.error('Get programs error:', error);
    res.status(500).json({
      error: 'Failed to get programs',
      message: 'Internal server error',
    });
  }
};

// Get program by ID
export const getProgramById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const program = await prisma.program.findUnique({
      where: { id: id as string },
    });

    if (!program) {
      res.status(404).json({
        error: 'Program not found',
        message: 'The requested program does not exist',
      });
      return;
    }

    // Only show active programs to non-admin users
    if (!program.isActive && req.user?.role !== 'ADMIN') {
      res.status(404).json({
        error: 'Program not found',
        message: 'The requested program does not exist',
      });
      return;
    }

    res.status(200).json({ program });
  } catch (error) {
    console.error('Get program error:', error);
    res.status(500).json({
      error: 'Failed to get program',
      message: 'Internal server error',
    });
  }
};

// Create program (admin only)
export const createProgram = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const validatedData = CreateProgramSchema.parse(req.body);

    const program = await prisma.program.create({
      data: validatedData,
    });

    res.status(201).json({
      message: 'Program created successfully',
      program,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Create program error:', error);
    res.status(500).json({
      error: 'Failed to create program',
      message: 'Internal server error',
    });
  }
};

// Update program (admin only)
export const updateProgram = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;
    const validatedData = UpdateProgramSchema.parse(req.body);

    const existingProgram = await prisma.program.findUnique({
      where: { id: id as string },
    });

    if (!existingProgram) {
      res.status(404).json({
        error: 'Program not found',
        message: 'The requested program does not exist',
      });
      return;
    }

    // Delete old files if new ones are being uploaded
    const filesToDelete: string[] = [];
    if (validatedData.featuredImage && validatedData.featuredImage !== existingProgram.featuredImage && existingProgram.featuredImage) {
      filesToDelete.push(existingProgram.featuredImage);
    }
    if (validatedData.featuredVideo && validatedData.featuredVideo !== existingProgram.featuredVideo && existingProgram.featuredVideo) {
      filesToDelete.push(existingProgram.featuredVideo);
    }
    if (filesToDelete.length > 0) {
      await deleteUploadedFiles(filesToDelete);
    }

    const updatedProgram = await prisma.program.update({
      where: { id: id as string },
      data: validatedData,
    });

    res.status(200).json({
      message: 'Program updated successfully',
      program: updatedProgram,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Update program error:', error);
    res.status(500).json({
      error: 'Failed to update program',
      message: 'Internal server error',
    });
  }
};

// Delete program (admin only)
export const deleteProgram = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;

    const existingProgram = await prisma.program.findUnique({
      where: { id: id as string },
    });

    if (!existingProgram) {
      res.status(404).json({
        error: 'Program not found',
        message: 'The requested program does not exist',
      });
      return;
    }

    // Delete associated files before deleting the program
    const filesToDelete = [existingProgram.featuredImage, existingProgram.featuredVideo].filter(Boolean);
    if (filesToDelete.length > 0) {
      await deleteUploadedFiles(filesToDelete);
    }

    await prisma.program.delete({
      where: { id: id as string },
    });

    res.status(200).json({
      message: 'Program deleted successfully',
    });
  } catch (error) {
    console.error('Delete program error:', error);
    res.status(500).json({
      error: 'Failed to delete program',
      message: 'Internal server error',
    });
  }
};