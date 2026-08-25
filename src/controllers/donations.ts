import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database';

// Validation schemas
const DonationSchema = z.object({
  amount: z.number().min(1, 'Minimum donation is $1'),
  currency: z.string().default('usd'),
  type: z.enum(['ONE_TIME', 'RECURRING']).default('ONE_TIME'),
  campaign: z.string().optional(),
  donorName: z.string().optional(),
  donorEmail: z.string().email().optional(),
  isAnonymous: z.boolean().default(false),
  paymentId: z.string().optional(), // Generic payment ID from any payment processor
});

const UpdateDonationSchema = z.object({
  amount: z.number().min(1).optional(),
  donorName: z.string().optional(),
  donorEmail: z.string().email().optional(),
  isAnonymous: z.boolean().optional(),
});

// Create donation intent
export const createDonation = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = DonationSchema.parse(req.body);

    // Create donation record
    const donation = await prisma.donation.create({
      data: {
        amount: Math.round(validatedData.amount * 100), // Store in cents
        currency: validatedData.currency.toUpperCase(),
        type: validatedData.type,
        campaign: validatedData.campaign,
        isAnonymous: validatedData.isAnonymous,
        donorName: validatedData.donorName,
        donorEmail: validatedData.donorEmail,
        paymentId: validatedData.paymentId || `donation_${Date.now()}`,
        userId: req.user?.id,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      message: 'Donation created successfully',
      donation: {
        id: donation.id,
        amount: donation.amount / 100, // Convert back from cents
        currency: donation.currency,
        type: donation.type,
        status: donation.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Create donation error:', error);
    res.status(500).json({
      error: 'Failed to create donation',
      message: 'Internal server error',
    });
  }
};

// Create donation pledge (no auth required)
const PledgeSchema = z.object({
  amount: z.number().min(1, 'Minimum donation is $1'),
  currency: z.string().default('USD'),
  type: z.enum(['ONE_TIME', 'RECURRING']).default('ONE_TIME'),
  donorName: z.string().min(1, 'Name is required'),
  donorEmail: z.string().email('Valid email is required'),
  message: z.string().optional(),
});

export const createPledge = async (req: Request, res: Response) => {
  try {
    const validatedData = PledgeSchema.parse(req.body);

    const reference = `HF-${Date.now().toString(36).toUpperCase()}`;

    const donation = await prisma.donation.create({
      data: {
        amount: Math.round(validatedData.amount * 100),
        currency: validatedData.currency.toUpperCase(),
        type: validatedData.type,
        donorName: validatedData.donorName,
        donorEmail: validatedData.donorEmail,
        campaign: validatedData.message || undefined,
        paymentId: reference,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      message: 'Donation pledge created successfully',
      donation: {
        id: donation.id,
        reference,
        amount: donation.amount / 100,
        currency: donation.currency,
        type: donation.type,
        status: donation.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Create pledge error:', error);
    res.status(500).json({
      error: 'Failed to create pledge',
      message: 'Internal server error',
    });
  }
};

// Get user donations
export const getUserDonations = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const donations = await prisma.donation.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit,
      select: {
        id: true,
        amount: true,
        currency: true,
        type: true,
        campaign: true,
        isAnonymous: true,
        donorName: true,
        donorEmail: true,
        status: true,
        createdAt: true,
      },
    });

    const totalDonations = await prisma.donation.count({
      where: {
        userId: req.user.id,
      },
    });

    const totalAmount = await prisma.donation.aggregate({
      where: {
        userId: req.user.id,
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
    });

    res.status(200).json({
      donations,
      pagination: {
        page,
        limit,
        total: totalDonations,
        pages: Math.ceil(totalDonations / limit),
      },
      stats: {
        totalAmount: totalAmount._sum.amount || 0,
        totalCount: totalDonations,
      },
    });
  } catch (error) {
    console.error('Get user donations error:', error);
    res.status(500).json({
      error: 'Failed to get donations',
      message: 'Internal server error',
    });
  }
};

// Get all donations (admin only)
export const getAllDonations = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const campaign = req.query.campaign as string;

    const where: any = {};
    if (status) where.status = status;
    if (campaign) where.campaign = campaign;

    const donations = await prisma.donation.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const totalDonations = await prisma.donation.count({ where });

    const stats = await prisma.donation.aggregate({
      where: { status: 'COMPLETED' },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    res.status(200).json({
      donations,
      pagination: {
        page,
        limit,
        total: totalDonations,
        pages: Math.ceil(totalDonations / limit),
      },
      stats: {
        totalAmount: stats._sum.amount || 0,
        totalCount: stats._count.id,
      },
    });
  } catch (error) {
    console.error('Get all donations error:', error);
    res.status(500).json({
      error: 'Failed to get donations',
      message: 'Internal server error',
    });
  }
};

// Get donation by ID
export const getDonationById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const donation = await prisma.donation.findUnique({
      where: { id: id as string },
      include: {
        user: req.user?.role === 'ADMIN' ? {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        } : false,
      },
    });

    if (!donation) {
      res.status(404).json({
        error: 'Donation not found',
        message: 'The requested donation does not exist',
      });
      return;
    }

    // Check if user can access this donation
    if (req.user?.role !== 'ADMIN' && donation.userId !== req.user?.id) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own donations',
      });
      return;
    }

    res.status(200).json({ donation });
  } catch (error) {
    console.error('Get donation error:', error);
    res.status(500).json({
      error: 'Failed to get donation',
      message: 'Internal server error',
    });
  }
};

// Update donation (limited fields)
export const updateDonation = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const validatedData = UpdateDonationSchema.parse(req.body);

    // Check if donation exists and belongs to user
    const existingDonation = await prisma.donation.findUnique({
      where: { id: id as string },
    });

    if (!existingDonation) {
      res.status(404).json({
        error: 'Donation not found',
        message: 'The requested donation does not exist',
      });
      return;
    }

    // Check permissions
    if (req.user?.role !== 'ADMIN' && existingDonation.userId !== req.user?.id) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own donations',
      });
      return;
    }

    // Only allow updates if donation is still pending
    if (existingDonation.status !== 'PENDING') {
      res.status(400).json({
        error: 'Cannot update donation',
        message: 'Only pending donations can be updated',
      });
      return;
    }

    const updatedDonation = await prisma.donation.update({
      where: { id: id as string },
      data: validatedData,
      select: {
        id: true,
        amount: true,
        currency: true,
        type: true,
        campaign: true,
        isAnonymous: true,
        donorName: true,
        donorEmail: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      message: 'Donation updated successfully',
      donation: updatedDonation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Update donation error:', error);
    res.status(500).json({
      error: 'Failed to update donation',
      message: 'Internal server error',
    });
  }
};

// Get donation statistics
export const getDonationStats = async (req: Request, res: Response) => {
  try {
    const timeframe = req.query.timeframe as string || '30d';
    
    let dateFilter: Date;
    switch (timeframe) {
      case '7d':
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        dateFilter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        dateFilter = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const [totalStats, recentStats, campaignStats] = await Promise.all([
      // All time stats
      prisma.donation.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // Recent stats
      prisma.donation.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: dateFilter },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // Stats by campaign
      prisma.donation.groupBy({
        by: ['campaign'],
        where: {
          status: 'COMPLETED',
          createdAt: { gte: dateFilter },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    res.status(200).json({
      timeframe,
      total: {
        amount: totalStats._sum.amount || 0,
        count: totalStats._count.id,
      },
      recent: {
        amount: recentStats._sum.amount || 0,
        count: recentStats._count.id,
      },
      campaigns: campaignStats.map((stat: any) => ({
        campaign: stat.campaign || 'general',
        amount: stat._sum.amount || 0,
        count: stat._count.id,
      })),
    });
  } catch (error) {
    console.error('Get donation stats error:', error);
    res.status(500).json({
      error: 'Failed to get donation statistics',
      message: 'Internal server error',
    });
  }
};