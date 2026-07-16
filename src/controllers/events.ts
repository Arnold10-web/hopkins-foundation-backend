import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../utils/database';
import { emailService } from '../services/emailService';
import { deleteUploadedFile } from '../utils/fileUtils';

// Validation schemas
const CreateEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  eventDate: z.string().min(1, 'Event date is required'),
  eventTime: z.string().min(1, 'Event time is required'),
  endTime: z.string().optional(),
  location: z.string().optional(),
  isVirtual: z.boolean().default(false),
  meetingLink: z.string().optional(),
  maxAttendees: z.number().optional(),
  featuredImage: z.string().optional(),
  category: z.string().optional(),
  isPublished: z.boolean().default(true),
});

const UpdateEventSchema = CreateEventSchema.partial();

const RegisterForEventSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  message: z.string().optional(),
});

// Get all published events (public)
export const getPublicEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { upcoming, past, limit, page = 1 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = limit ? parseInt(limit as string) : undefined;

    const where: Prisma.EventWhereInput = { isPublished: true };
    const now = new Date();

    if (upcoming === 'true') {
      where.eventDate = { gte: now };
    } else if (past === 'true') {
      where.eventDate = { lt: now };
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        _count: {
          select: { registrations: true }
        }
      },
      orderBy: { eventDate: upcoming === 'true' ? 'asc' : 'desc' },
      skip: limitNum ? (pageNum - 1) * limitNum : undefined,
      take: limitNum,
    });

    const total = await prisma.event.count({ where });

    res.json({
      events: events.map(event => ({
        ...event,
        registrationCount: event._count.registrations,
        isFull: event.maxAttendees ? event._count.registrations >= event.maxAttendees : false,
        _count: undefined,
      })),
      pagination: limitNum ? {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      } : undefined,
    });
  } catch (error) {
    console.error('Get public events error:', error);
    res.status(500).json({
      error: 'Failed to fetch events',
      message: 'Internal server error',
    });
  }
};

// Get single event by ID (public)
export const getEventById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: { registrations: true }
        }
      }
    });

    if (!event) {
      res.status(404).json({
        error: 'Event not found',
        message: 'The requested event does not exist',
      });
      return;
    }

    // Only show published events to non-admin users
    if (!event.isPublished && (!req.user || req.user.role !== 'ADMIN')) {
      res.status(404).json({
        error: 'Event not found',
        message: 'The requested event does not exist',
      });
      return;
    }

    res.json({
      event: {
        ...event,
        registrationCount: event._count.registrations,
        isFull: event.maxAttendees ? event._count.registrations >= event.maxAttendees : false,
        _count: undefined,
      }
    });
  } catch (error) {
    console.error('Get event by ID error:', error);
    res.status(500).json({
      error: 'Failed to fetch event',
      message: 'Internal server error',
    });
  }
};

// Register for event (public)
export const registerForEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const validatedData = RegisterForEventSchema.parse(req.body);

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: { registrations: true }
        }
      }
    });

    if (!event || !event.isPublished) {
      res.status(404).json({
        error: 'Event not found',
        message: 'The requested event does not exist',
      });
      return;
    }

    // Check if event is full
    if (event.maxAttendees && event._count.registrations >= event.maxAttendees) {
      res.status(400).json({
        error: 'Event is full',
        message: 'This event has reached maximum capacity',
      });
      return;
    }

    // Check if already registered
    const existingRegistration = await prisma.eventRegistration.findUnique({
      where: {
        eventId_email: {
          eventId: id,
          email: validatedData.email
        }
      }
    });

    if (existingRegistration) {
      res.status(400).json({
        error: 'Already registered',
        message: 'You are already registered for this event',
      });
      return;
    }

    // Create registration
    const registration = await prisma.eventRegistration.create({
      data: {
        eventId: id,
        ...validatedData,
      },
      include: {
        event: true
      }
    });

    // Send confirmation email
    try {
      await emailService.sendEventRegistrationConfirmation(
        validatedData.email,
        `${validatedData.firstName} ${validatedData.lastName}`,
        event
      );

      await prisma.eventRegistration.update({
        where: { id: registration.id },
        data: { confirmationSent: true }
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the registration if email fails
    }

    res.status(201).json({
      message: 'Successfully registered for event',
      registration: {
        id: registration.id,
        eventTitle: event.title,
        eventDate: event.eventDate,
        confirmationSent: true,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Register for event error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error',
    });
  }
};

// Admin: Get all events
export const getAllEventsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const events = await prisma.event.findMany({
      include: {
        _count: {
          select: { registrations: true }
        }
      },
      orderBy: { eventDate: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

    const total = await prisma.event.count();

    res.json({
      events: events.map(event => ({
        ...event,
        registrationCount: event._count.registrations,
        isFull: event.maxAttendees ? event._count.registrations >= event.maxAttendees : false,
        _count: undefined,
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      }
    });
  } catch (error) {
    console.error('Get all events admin error:', error);
    res.status(500).json({
      error: 'Failed to fetch events',
      message: 'Internal server error',
    });
  }
};

// Admin: Create event
export const createEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const validatedData = CreateEventSchema.parse(req.body);

    const event = await prisma.event.create({
      data: {
        ...validatedData,
        eventDate: new Date(validatedData.eventDate),
      },
    });

    res.status(201).json({
      message: 'Event created successfully',
      event,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Create event error:', error);
    res.status(500).json({
      error: 'Failed to create event',
      message: 'Internal server error',
    });
  }
};

// Admin: Update event
export const updateEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;
    const validatedData = UpdateEventSchema.parse(req.body);

    // Delete old featured image if a new one is being uploaded
    if (validatedData.featuredImage) {
      const existingEvent = await prisma.event.findUnique({ where: { id } });
      if (existingEvent?.featuredImage && existingEvent.featuredImage !== validatedData.featuredImage) {
        await deleteUploadedFile(existingEvent.featuredImage);
      }
    }

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...validatedData,
        eventDate: validatedData.eventDate ? new Date(validatedData.eventDate) : undefined,
      },
    });

    res.json({
      message: 'Event updated successfully',
      event,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Update event error:', error);
    res.status(500).json({
      error: 'Failed to update event',
      message: 'Internal server error',
    });
  }
};

// Admin: Delete event
export const deleteEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;

    // Get the event first to retrieve the featuredImage path
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      res.status(404).json({
        error: 'Event not found',
        message: 'The requested event does not exist',
      });
      return;
    }

    // Delete the featured image file if it exists
    if (event.featuredImage) {
      await deleteUploadedFile(event.featuredImage);
    }

    // Delete the event from database
    await prisma.event.delete({
      where: { id },
    });

    res.json({
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      error: 'Failed to delete event',
      message: 'Internal server error',
    });
  }
};

// Admin: Get event registrations
export const getEventRegistrations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId: id },
      include: {
        event: {
          select: {
            title: true,
            eventDate: true,
            eventTime: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ registrations });
  } catch (error) {
    console.error('Get event registrations error:', error);
    res.status(500).json({
      error: 'Failed to fetch registrations',
      message: 'Internal server error',
    });
  }
};

// Admin: Mark attendee as attended
export const markAttended = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const registrationId = req.params.registrationId as string;
    const { attended } = req.body;

    const registration = await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { attended },
    });

    res.json({
      message: 'Attendance updated successfully',
      registration,
    });
  } catch (error) {
    console.error('Mark attended error:', error);
    res.status(500).json({
      error: 'Failed to update attendance',
      message: 'Internal server error',
    });
  }
};