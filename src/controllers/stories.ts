import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database';
import { deleteUploadedFiles } from '../utils/fileUtils';

// Validation schemas
const CreateStorySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().min(1, 'Excerpt is required'),
  slug: z.string().min(1, 'Slug is required'),
  featuredImage: z.string().optional(),
  featuredVideo: z.string().optional(),
  isPublished: z.boolean().default(true),
  publishedAt: z.string().datetime().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  readTime: z.number().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  // Source attribution fields
  isExternal: z.boolean().default(false),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  sourceName: z.string().optional(),
  sourceAuthor: z.string().optional(),
  sourceDate: z.string().datetime().optional(),
});

const UpdateStorySchema = CreateStorySchema.partial();

// Get all stories
export const getStories = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const category = req.query.category as string;
    const featured = req.query.featured === 'true';
    const offset = (page - 1) * limit;

    const where: any = {
      isPublished: true,
    };

    if (category) {
      where.category = category;
    }

    if (featured) {
      where.isFeatured = true;
    }

    const stories = await prisma.story.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
      ],
      skip: offset,
      take: limit,
      select: {
        id: true,
        title: true,
        excerpt: true,
        slug: true,
        featuredImage: true,
        featuredVideo: true,
        category: true,
        tags: true,
        readTime: true,
        views: true,
        publishedAt: true,
        createdAt: true,
        content: true,
      },
    });

    const totalStories = await prisma.story.count({ where });

    res.status(200).json({
      stories,
      pagination: {
        page,
        limit,
        total: totalStories,
        pages: Math.ceil(totalStories / limit),
      },
    });
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({
      error: 'Failed to get stories',
      message: 'Internal server error',
    });
  }
};

// Get story by ID
export const getStoryById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const story = await prisma.story.findUnique({
      where: { id: id as string },
    });

    if (!story) {
      res.status(404).json({
        error: 'Story not found',
        message: 'The requested story does not exist',
      });
      return;
    }

    // Only show published stories to non-admin users
    if (!story.isPublished && req.user?.role !== 'ADMIN') {
      res.status(404).json({
        error: 'Story not found',
        message: 'The requested story does not exist',
      });
      return;
    }

    // Track content access for authenticated users
    if (req.user) {
      await prisma.contentAccess.upsert({
        where: {
          userId_storyId: {
            userId: req.user.id,
            storyId: story.id,
          },
        },
        update: {
          accessedAt: new Date(),
        },
        create: {
          userId: req.user.id,
          storyId: story.id,
        },
      });
    }

    // Increment view count
    await prisma.story.update({
      where: { id: story.id },
      data: {
        views: {
          increment: 1,
        },
      },
    });

    res.status(200).json({ story });
  } catch (error) {
    console.error('Get story error:', error);
    res.status(500).json({
      error: 'Failed to get story',
      message: 'Internal server error',
    });
  }
};

// Create story (admin only)
export const createStory = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const validatedData = CreateStorySchema.parse(req.body);

    const storyData: any = {
      ...validatedData,
      publishedAt: validatedData.publishedAt ? new Date(validatedData.publishedAt) : new Date(),
    };
    
    if (validatedData.sourceDate) {
      storyData.sourceDate = new Date(validatedData.sourceDate);
    }

    const story = await prisma.story.create({
      data: storyData,
    });

    res.status(201).json({
      message: 'Story created successfully',
      story,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Create story error:', error);
    res.status(500).json({
      error: 'Failed to create story',
      message: 'Internal server error',
    });
  }
};

// Update story (admin only)
export const updateStory = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;
    const validatedData = UpdateStorySchema.parse(req.body);

    const existingStory = await prisma.story.findUnique({
      where: { id: id as string },
    });

    if (!existingStory) {
      res.status(404).json({
        error: 'Story not found',
        message: 'The requested story does not exist',
      });
      return;
    }

    // Delete old files if new ones are being uploaded
    const filesToDelete: string[] = [];
    if (validatedData.featuredImage && validatedData.featuredImage !== existingStory.featuredImage && existingStory.featuredImage) {
      filesToDelete.push(existingStory.featuredImage);
    }
    if (validatedData.featuredVideo && validatedData.featuredVideo !== existingStory.featuredVideo && existingStory.featuredVideo) {
      filesToDelete.push(existingStory.featuredVideo);
    }
    if (filesToDelete.length > 0) {
      await deleteUploadedFiles(filesToDelete);
    }

    const updatedStory = await prisma.story.update({
      where: { id: id as string },
      data: validatedData,
    });

    res.status(200).json({
      message: 'Story updated successfully',
      story: updatedStory,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Update story error:', error);
    res.status(500).json({
      error: 'Failed to update story',
      message: 'Internal server error',
    });
  }
};

// Delete story (admin only)
export const deleteStory = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;

    const existingStory = await prisma.story.findUnique({
      where: { id: id as string },
    });

    if (!existingStory) {
      res.status(404).json({
        error: 'Story not found',
        message: 'The requested story does not exist',
      });
      return;
    }

    // Delete associated files before deleting the story
    const filesToDelete = [existingStory.featuredImage, existingStory.featuredVideo].filter(Boolean);
    if (filesToDelete.length > 0) {
      await deleteUploadedFiles(filesToDelete);
    }

    await prisma.story.delete({
      where: { id: id as string },
    });

    res.status(200).json({
      message: 'Story deleted successfully',
    });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({
      error: 'Failed to delete story',
      message: 'Internal server error',
    });
  }
};

// Get featured stories
export const getFeaturedStories = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 3;

    const stories = await prisma.story.findMany({
      where: {
        isPublished: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        title: true,
        excerpt: true,
        featuredImage: true,
        featuredVideo: true,
        category: true,
        tags: true,
        createdAt: true,
      },
    });

    res.status(200).json({ stories });
  } catch (error) {
    console.error('Get featured stories error:', error);
    res.status(500).json({
      error: 'Failed to get featured stories',
      message: 'Internal server error',
    });
  }
};