import { Request, Response } from 'express';
import prisma from '../utils/database';

// Get member dashboard data
export const getMemberDashboard = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    const userId = req.user.id;

    // Get user profile with donation stats
    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        memberSince: true,
        profileImage: true,
        isEmailVerified: true,
        lastLogin: true,
      },
    });

    if (!userProfile) {
      res.status(404).json({
        error: 'User not found',
        message: 'User profile not found',
      });
      return;
    }

    // Get donation statistics
    const donationStats = await prisma.donation.aggregate({
      where: {
        userId: userId,
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    // Get recent donations
    const recentDonations = await prisma.donation.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      select: {
        id: true,
        amount: true,
        currency: true,
        type: true,
        campaign: true,
        status: true,
        createdAt: true,
      },
    });

    // Get content access statistics
    const contentAccessCount = await prisma.contentAccess.count({
      where: {
        userId: userId,
      },
    });

    // Calculate impact metrics based on donations
    const totalDonated = donationStats._sum.amount || 0;
    const impactMetrics = calculateImpactMetrics(totalDonated);

    const dashboardData = {
      user: userProfile,
      stats: {
        totalDonated: totalDonated / 100, // Convert from cents
        donationCount: donationStats._count.id,
        contentAccessed: contentAccessCount,
      },
      recentDonations: recentDonations.map(donation => ({
        ...donation,
        amount: donation.amount / 100, // Convert from cents
      })),
      impactMetrics,
    };

    res.status(200).json(dashboardData);
  } catch (error) {
    console.error('Get member dashboard error:', error);
    res.status(500).json({
      error: 'Failed to get member dashboard',
      message: 'Internal server error',
    });
  }
};

// Get member content by ID with access tracking
export const getMemberContentById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Member access required',
      });
      return;
    }

    const id = req.params.id as string;

        const story = await prisma.story.findUnique({
          where: { id: id as string },
        });

    if (!story) {
      res.status(404).json({
        error: 'Content not found',
        message: 'The requested content does not exist',
      });
      return;
    }

    // Check if content is published
    if (!story.isPublished && req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Access denied',
        message: 'This content is not published yet',
      });
      return;
    }

    // Track content access
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
    console.error('Get member content error:', error);
    res.status(500).json({
      error: 'Failed to get content',
      message: 'Internal server error',
    });
  }
};

// Get member activity/engagement history
export const getMemberActivity = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Get content access history
    const contentAccess = await prisma.contentAccess.findMany({
      where: {
        userId: userId,
      },
      include: {
        story: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
      },
      orderBy: {
        accessedAt: 'desc',
      },
      skip: offset,
      take: limit,
    });

    // Get donation history
    const donations = await prisma.donation.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        amount: true,
        currency: true,
        type: true,
        campaign: true,
        status: true,
        createdAt: true,
      },
    });

    const totalActivities = await prisma.contentAccess.count({
      where: {
        userId: userId,
      },
    });

    const activityData = {
      contentAccess: contentAccess.map(access => ({
        id: access.id,
        accessedAt: access.accessedAt,
        content: access.story,
      })),
      donations: donations.map(donation => ({
        ...donation,
        amount: donation.amount / 100, // Convert from cents
      })),
      pagination: {
        page,
        limit,
        total: totalActivities,
        pages: Math.ceil(totalActivities / limit),
      },
    };

    res.status(200).json(activityData);
  } catch (error) {
    console.error('Get member activity error:', error);
    res.status(500).json({
      error: 'Failed to get member activity',
      message: 'Internal server error',
    });
  }
};

// Helper function to calculate impact metrics
const calculateImpactMetrics = (totalDonatedCents: number) => {
  const totalDonated = totalDonatedCents / 100;
  
  return {
    studentsSupported: Math.floor(totalDonated / 25), // $25 supports 1 student
    womenTrained: Math.floor(totalDonated / 100), // $100 trains 1 woman
    communitiesReached: Math.floor(totalDonated / 500), // $500 reaches 1 community
    treesPlanted: Math.floor(totalDonated / 5), // $5 plants 1 tree
    mealsProvided: Math.floor(totalDonated / 2), // $2 provides 1 meal
  };
};