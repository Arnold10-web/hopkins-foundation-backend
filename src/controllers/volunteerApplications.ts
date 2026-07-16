import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database';
import { emailService } from '../services/emailService';

// Validation schema for volunteer application
const VolunteerApplicationSchema = z.object({
  // Personal Information
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
  
  // Location (optional)
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  
  // Professional Information
  education: z.string().optional(),
  currentOccupation: z.string().optional(),
  skills: z.array(z.string()).default([]),
  experience: z.string().optional(),
  
  // Volunteer Information
  position: z.string().min(3, 'Please specify the position you are applying for'),
  availability: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  motivation: z.string().min(50, 'Please provide at least 50 characters explaining your motivation'),
  previousVolunteer: z.boolean().default(false),
  previousVolunteerDetails: z.string().optional(),
  
  // Additional Information
  languages: z.array(z.string()).default([]),
  references: z.string().optional(),
  resume: z.string().url().optional().or(z.literal('')),
  linkedIn: z.string().url().optional().or(z.literal('')),
});

const UpdateApplicationStatusSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED']),
  reviewNotes: z.string().optional(),
});

// Submit a volunteer application (PUBLIC)
export const submitApplication = async (req: Request, res: Response) => {
  try {
    const validatedData = VolunteerApplicationSchema.parse(req.body);

    // Check if email already has a pending or accepted application
    const existingApplication = await prisma.volunteerApplication.findFirst({
      where: {
        email: validatedData.email,
        status: {
          in: ['PENDING', 'ACCEPTED']
        }
      }
    });

    if (existingApplication) {
      res.status(409).json({
        error: 'Application already exists',
        message: 'You already have a pending or accepted application. Please wait for a response.',
      });
      return;
    }

    // Create the application
    const application = await prisma.volunteerApplication.create({
      data: {
        ...validatedData,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      message: 'Application submitted successfully',
      application: {
        id: application.id,
        firstName: application.firstName,
        lastName: application.lastName,
        email: application.email,
        position: application.position,
        status: application.status,
        createdAt: application.createdAt,
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

    console.error('Submit application error:', error);
    res.status(500).json({
      error: 'Failed to submit application',
      message: 'Internal server error',
    });
  }
};

// Get all applications (ADMIN ONLY)
export const getAllApplications = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const position = req.query.position as string;
    const search = req.query.search as string;

    // Build where clause
    const where: any = {};
    if (status) where.status = status;
    if (position) where.position = { contains: position, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [applications, totalApplications] = await Promise.all([
      prisma.volunteerApplication.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.volunteerApplication.count({ where }),
    ]);

    // Get statistics
    const stats = await prisma.volunteerApplication.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const statusCounts = {
      PENDING: 0,
      REVIEWED: 0,
      ACCEPTED: 0,
      REJECTED: 0,
    };

    stats.forEach((stat: any) => {
      statusCounts[stat.status as keyof typeof statusCounts] = stat._count.id;
    });

    res.status(200).json({
      applications,
      pagination: {
        page,
        limit,
        total: totalApplications,
        pages: Math.ceil(totalApplications / limit),
      },
      stats: statusCounts,
    });
  } catch (error) {
    console.error('Get all applications error:', error);
    res.status(500).json({
      error: 'Failed to get applications',
      message: 'Internal server error',
    });
  }
};

// Get single application by ID (ADMIN ONLY)
export const getApplicationById = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;

    const application = await prisma.volunteerApplication.findUnique({
      where: { id: id as string },
    });

    if (!application) {
      res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist',
      });
      return;
    }

    res.status(200).json({ application });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({
      error: 'Failed to get application',
      message: 'Internal server error',
    });
  }
};

// Update application status (ADMIN ONLY)
export const updateApplicationStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;
    const validatedData = UpdateApplicationStatusSchema.parse(req.body);

    const application = await prisma.volunteerApplication.findUnique({
      where: { id: id as string },
    });

    if (!application) {
      res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist',
      });
      return;
    }

    const updatedApplication = await prisma.volunteerApplication.update({
      where: { id: id as string },
      data: {
        status: validatedData.status,
        reviewNotes: validatedData.reviewNotes,
        reviewedBy: req.user.email,
        reviewedAt: new Date(),
      },
    });

    // Send email notification if status is ACCEPTED or REJECTED
    if (validatedData.status === 'ACCEPTED' || validatedData.status === 'REJECTED') {
      try {
        await emailService.sendVolunteerStatusNotification(
          updatedApplication.email,
          updatedApplication.firstName,
          updatedApplication.lastName,
          updatedApplication.position,
          validatedData.status,
          validatedData.reviewNotes
        );
      } catch (emailError) {
        console.error('Failed to send status notification email:', emailError);
        // Continue even if email fails - status is still updated
      }
    }

    res.status(200).json({
      message: 'Application status updated successfully',
      application: updatedApplication,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Update application status error:', error);
    res.status(500).json({
      error: 'Failed to update application status',
      message: 'Internal server error',
    });
  }
};

// Delete application (ADMIN ONLY)
export const deleteApplication = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;

    const application = await prisma.volunteerApplication.findUnique({
      where: { id: id as string },
    });

    if (!application) {
      res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist',
      });
      return;
    }

    await prisma.volunteerApplication.delete({
      where: { id: id as string },
    });

    res.status(200).json({
      message: 'Application deleted successfully',
    });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({
      error: 'Failed to delete application',
      message: 'Internal server error',
    });
  }
};

// Get public statistics for Get Involved page (PUBLIC)
export const getPublicStats = async (req: Request, res: Response) => {
  try {
    const [totalApplications, acceptedCount, recentApplicationsCount] = await Promise.all([
      prisma.volunteerApplication.count(),
      prisma.volunteerApplication.count({
        where: { status: 'ACCEPTED' }
      }),
      prisma.volunteerApplication.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
    ]);

    // Get count of unique positions (opportunities)
    const positions = await prisma.volunteerApplication.findMany({
      select: { position: true },
      distinct: ['position'],
    });

    res.status(200).json({
      stats: {
        activeVolunteers: acceptedCount,
        totalApplications,
        recentApplications: recentApplicationsCount,
        availablePositions: positions.length,
      },
    });
  } catch (error) {
    console.error('Get public stats error:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: 'Internal server error',
    });
  }
};

// Get application statistics (ADMIN ONLY)
export const getApplicationStats = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const [statusCounts, positionCounts, recentApplications] = await Promise.all([
      // Count by status
      prisma.volunteerApplication.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
      }),

      // Count by position
      prisma.volunteerApplication.groupBy({
        by: ['position'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      }),

      // Recent applications (last 7 days)
      prisma.volunteerApplication.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const stats = {
      byStatus: statusCounts.reduce((acc: any, curr: any) => {
        acc[curr.status] = curr._count.id;
        return acc;
      }, {}),
      byPosition: positionCounts.map((p: any) => ({
        position: p.position,
        count: p._count.id,
      })),
      recentApplications,
      total: await prisma.volunteerApplication.count(),
    };

    res.status(200).json({ stats });
  } catch (error) {
    console.error('Get application stats error:', error);
    res.status(500).json({
      error: 'Failed to get application statistics',
      message: 'Internal server error',
    });
  }
};
