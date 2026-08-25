import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/database';

/**
 * Create first admin user
 * This endpoint should only be used once to create the initial admin
 * After that, it should be disabled or removed
 */
export const createFirstAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, secretKey } = req.body;

    // Security: Require a secret key to create admin
    const ADMIN_CREATION_SECRET = process.env.ADMIN_CREATION_SECRET || 'change-this-in-production';
    
    if (secretKey !== ADMIN_CREATION_SECRET) {
      res.status(403).json({ error: 'Invalid secret key' });
      return;
    }

    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (existingAdmin) {
      res.status(400).json({ 
        error: 'Admin user already exists',
        message: 'Cannot create multiple admin users through this endpoint'
      });
      return;
    }

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'password', 'firstName', 'lastName', 'secretKey']
      });
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'ADMIN',
        isEmailVerified: true, // Auto-verify admin
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        memberSince: true,
      }
    });

    console.log('🔐 First admin user created:', admin.email);

    res.status(201).json({
      message: 'Admin user created successfully',
      admin,
      important: 'Please disable this endpoint or change the secret key immediately!'
    });
  } catch (error: any) {
    console.error('❌ Error creating admin:', error);
    
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    res.status(500).json({ error: 'Failed to create admin user' });
  }
};

/**
 * Promote existing user to admin
 * Requires existing admin authentication
 */
export const promoteToAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string;
    const adminId = (req as any).user?.userId;

    // Verify requester is admin
    const requester = await prisma.user.findUnique({
      where: { id: adminId }
    });

    if (requester?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only admins can promote users' });
      return;
    }

    // Promote user
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      }
    });

    console.log(`🔐 User promoted to admin: ${user.email}`);

    res.json({
      message: 'User promoted to admin successfully',
      user
    });
  } catch (error) {
    console.error('❌ Error promoting user:', error);
    res.status(500).json({ error: 'Failed to promote user to admin' });
  }
};

// ==================== DASHBOARD STATS ====================

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get total donations
    const donationStats = await prisma.donation.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true
    });

    // Get unique donor count
    const donorCount = await prisma.donation.groupBy({
      by: ['userId', 'donorEmail'],
      where: { status: 'COMPLETED' }
    });

    // Get total users
    const userCount = await prisma.user.count();

    // Get total published stories
    const storyCount = await prisma.story.count({
      where: { isPublished: true }
    });

    // Get recent donations
    const recentDonations = await prisma.donation.findMany({
      where: { status: 'COMPLETED' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Get recent signups
    const recentSignups = await prisma.user.findMany({
      orderBy: { memberSince: 'desc' },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        memberSince: true
      }
    });

    res.json({
      success: true,
      data: {
        totalDonations: donationStats._sum.amount || 0,
        totalDonors: donorCount.length,
        totalUsers: userCount,
        totalStories: storyCount,
        recentDonations: recentDonations.map(d => ({
          id: d.id,
          amount: d.amount / 100,
          donorName: d.user 
            ? `${d.user.firstName} ${d.user.lastName}`
            : d.donorName || 'Anonymous',
          date: d.createdAt
        })),
        recentSignups: recentSignups.map(u => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          date: u.memberSince
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

// ==================== STORIES ====================

export const getAllStories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '10', status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where = status ? { isPublished: status === 'published' } : {};

    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.story.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        stories,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
};

export const getStoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    const story = await prisma.story.findUnique({
      where: { id }
    });

    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    res.json({ success: true, data: story });
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
};

export const createStory = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      content,
      excerpt,
      slug,
      featuredImage,
      featuredVideo,
      images,
      isPublished,
      category,
      tags,
      metaTitle,
      metaDescription
    } = req.body;

    // Validate required fields
    if (!title || !content || !excerpt || !slug) {
      res.status(400).json({ 
        error: 'Missing required fields',
        required: ['title', 'content', 'excerpt', 'slug']
      });
      return;
    }

    // Calculate read time (approximate)
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    const readTime = Math.ceil(wordCount / wordsPerMinute);

    const story = await prisma.story.create({
      data: {
        title,
        content,
        excerpt,
        slug,
        featuredImage,
        featuredVideo,
        images: Array.isArray(images) ? images : [],
        isPublished: isPublished || false,
        publishedAt: isPublished ? new Date() : null,
        category,
        tags: tags || [],
        readTime,
        metaTitle: metaTitle || title,
        metaDescription: metaDescription || excerpt
      }
    });

    console.log('✅ Story created:', story.title);

    res.status(201).json({
      success: true,
      data: story,
      message: 'Story created successfully'
    });
  } catch (error: any) {
    console.error('Error creating story:', error);
    
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'A story with this slug already exists' });
      return;
    }
    
    res.status(500).json({ error: 'Failed to create story' });
  }
};

export const updateStory = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const rawData = req.body;

    // Only pass fields that exist in the Prisma Story schema
    const allowedFields = [
      'title', 'content', 'excerpt', 'slug', 'featuredImage', 'featuredVideo', 'images',
      'isPublished', 'publishedAt', 'category', 'tags', 'readTime', 'views',
      'isExternal', 'sourceUrl', 'sourceName', 'sourceAuthor', 'sourceDate',
      'metaTitle', 'metaDescription'
    ];
    const updateData: any = {};
    for (const key of allowedFields) {
      if (rawData[key] !== undefined) {
        updateData[key] = rawData[key];
      }
    }

    // Sanitize empty strings to null for nullable fields
    const nullableFields = ['featuredImage', 'featuredVideo', 'category', 'sourceUrl', 'sourceName', 'sourceAuthor', 'sourceDate', 'metaTitle', 'metaDescription'];
    nullableFields.forEach(field => {
      if (updateData[field] === '' || updateData[field] === undefined) {
        updateData[field] = null;
      }
    });

    // Convert sourceDate string to Date object if present
    if (updateData.sourceDate && typeof updateData.sourceDate === 'string') {
      updateData.sourceDate = new Date(updateData.sourceDate);
    }

    // If content is updated, recalculate read time
    if (updateData.content) {
      const wordsPerMinute = 200;
      const wordCount = updateData.content.split(/\s+/).length;
      updateData.readTime = Math.ceil(wordCount / wordsPerMinute);
    }

    // Ensure tags is an array
    if (!Array.isArray(updateData.tags)) {
      updateData.tags = [];
    }

    // Ensure images is an array
    if (!Array.isArray(updateData.images)) {
      updateData.images = [];
    }

    const story = await prisma.story.update({
      where: { id },
      data: updateData
    });

    console.log('✅ Story updated:', story.title);

    res.json({
      success: true,
      data: story,
      message: 'Story updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating story:', error);
    
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Story not found' });
      return;
    }
    
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'A story with this slug already exists' });
      return;
    }
    
    res.status(500).json({ error: 'Failed to update story' });
  }
};

export const deleteStory = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    await prisma.story.delete({
      where: { id }
    });

    console.log('🗑️ Story deleted:', id);

    res.json({
      success: true,
      message: 'Story deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting story:', error);
    
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Story not found' });
      return;
    }
    
    res.status(500).json({ error: 'Failed to delete story' });
  }
};

export const publishStory = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { isPublished } = req.body;

    const story = await prisma.story.update({
      where: { id },
      data: {
        isPublished,
        publishedAt: isPublished ? new Date() : null
      }
    });

    console.log(`📢 Story ${isPublished ? 'published' : 'unpublished'}:`, story.title);

    res.json({
      success: true,
      data: story,
      message: `Story ${isPublished ? 'published' : 'unpublished'} successfully`
    });
  } catch (error) {
    console.error('Error publishing story:', error);
    res.status(500).json({ error: 'Failed to publish story' });
  }
};

// ==================== PROGRAMS ====================

export const getAllPrograms = async (req: Request, res: Response): Promise<void> => {
  try {
    const programs = await prisma.program.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({ 
      success: true, 
      programs: programs,
      data: programs  // Also include data for consistency
    });
  } catch (error) {
    console.error('Error fetching programs:', error);
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
};

export const createProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      slug,
      description,
      shortDescription,
      featuredImage,
      featuredVideo,
      images,
      location,
      targetGroup,
      duration,
      beneficiaries,
      impact,
      goals,
      features,
      isActive
    } = req.body;

    // Validate required fields
    if (!title || !slug || !description) {
      res.status(400).json({ 
        error: 'Missing required fields',
        required: ['title', 'slug', 'description']
      });
      return;
    }

    // Convert goals and features to arrays if they're strings
    const goalsArray = Array.isArray(goals) ? goals : (goals ? goals.split('\n').filter((g: string) => g.trim()) : []);
    const featuresArray = Array.isArray(features) ? features : (features ? features.split('\n').filter((f: string) => f.trim()) : []);

    const program = await prisma.program.create({
      data: {
        title,
        slug,
        description,
        shortDescription: shortDescription || description.substring(0, 200),
        featuredImage,
        featuredVideo,
        images: Array.isArray(images) ? images : [],
        location,
        targetGroup,
        duration,
        beneficiaries: beneficiaries ? parseInt(beneficiaries) : null,
        impact,
        goals: goalsArray,
        features: featuresArray,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    console.log('✅ Program created:', program.title);

    res.status(201).json({
      success: true,
      data: program,
      message: 'Program created successfully'
    });
  } catch (error: any) {
    console.error('Error creating program:', error);
    
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'A program with this slug already exists' });
      return;
    }
    
    res.status(500).json({ 
      error: 'Failed to create program',
      message: error.message 
    });
  }
};

export const updateProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updateData: any = { ...req.body };

    // Convert goals and features to arrays if they're strings
    if (updateData.goals && typeof updateData.goals === 'string') {
      updateData.goals = updateData.goals.split('\n').filter((g: string) => g.trim());
    }
    if (updateData.features && typeof updateData.features === 'string') {
      updateData.features = updateData.features.split('\n').filter((f: string) => f.trim());
    }

    // Convert beneficiaries to number if it's a string
    if (updateData.beneficiaries && typeof updateData.beneficiaries === 'string') {
      updateData.beneficiaries = parseInt(updateData.beneficiaries);
    }
    
    const program = await prisma.program.update({
      where: { id },
      data: updateData
    });

    console.log('✅ Program updated:', program.title);

    res.json({
      success: true,
      data: program,
      message: 'Program updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating program:', error);
    
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'A program with this slug already exists' });
      return;
    }
    
    res.status(500).json({ 
      error: 'Failed to update program',
      message: error.message 
    });
  }
};

export const deleteProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    await prisma.program.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Program deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting program:', error);
    res.status(500).json({ error: 'Failed to delete program' });
  }
};

// ==================== USERS ====================

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: parseInt(limit as string),
        orderBy: { memberSince: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isEmailVerified: true,
          memberSince: true,
          lastLogin: true,
          _count: {
            select: { donations: true }
          }
        }
      }),
      prisma.user.count()
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// ==================== DONATIONS ====================

export const getAllDonations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where = status ? { status: status as any } : {};

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }),
      prisma.donation.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        donations,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
};

// ==================== CONTACT MESSAGES ====================

export const getContactMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', isRead } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where = isRead !== undefined ? { isRead: isRead === 'true' } : {};

    const [messages, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.contactMessage.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

export const markMessageAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const message = await prisma.contactMessage.update({
      where: { id },
      data: { isRead: true }
    });

    res.json({
      success: true,
      data: message,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
};

// ==================== AUTO-COMPUTE STATS ====================

export const autoComputeStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // Compute stats from real data in the database
    const [
      totalUsers,
      activePrograms,
      totalDonations,
      completedDonations,
      totalEvents,
      volunteerApplications,
      publishedStories,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.program.count({ where: { isActive: true } }),
      prisma.donation.count(),
      prisma.donation.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true }, _count: true }),
      prisma.event.count(),
      prisma.volunteerApplication.findMany({
        select: { country: true, city: true, skills: true }
      }),
      prisma.story.count({ where: { isPublished: true } }),
    ]);

    // Derive communities from unique locations
    const uniqueCities = new Set(
      volunteerApplications
        .map(v => v.city)
        .filter(Boolean)
    );

    // Derive countries
    const uniqueCountries = new Set(
      volunteerApplications
        .map(v => v.country)
        .filter(Boolean)
    );

    // Women & youth trained: approximate from volunteer applications + event registrations
    const totalEventRegistrations = await prisma.eventRegistration.count();

    // Compute stats
    const computedStats = {
      livesTransformed: completedDonations._count || 0,
      programsActive: activePrograms,
      countriesServed: Math.max(uniqueCountries.size, 1),
      livesChangedGreenSkills: Math.min(Math.round((totalEventRegistrations / Math.max(totalUsers, 1)) * 100), 100) || 35,
      womenYouthTrained: totalEventRegistrations + volunteerApplications.length,
      communitiesReached: Math.max(uniqueCities.size, 1),
      activeCommunityMembers: totalUsers,
    };

    console.log('📊 Auto-computed stats:', computedStats);

    res.json({
      success: true,
      data: computedStats,
      message: 'Stats computed from live data'
    });
  } catch (error) {
    console.error('Error auto-computing stats:', error);
    res.status(500).json({ error: 'Failed to auto-compute stats' });
  }
};
