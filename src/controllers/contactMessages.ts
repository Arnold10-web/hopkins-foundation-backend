import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database';

// Validation schemas
const ContactMessageSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  subject: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
});

const UpdateContactMessageSchema = z.object({
  isRead: z.boolean().optional(),
  isReplied: z.boolean().optional(),
});

// Create contact message
export const createContactMessage = async (req: Request, res: Response) => {
  try {
    const validatedData = ContactMessageSchema.parse(req.body);

    const contactMessage = await prisma.contactMessage.create({
      data: validatedData,
    });

    res.status(201).json({
      message: 'Contact message sent successfully',
      contactMessage: {
        id: contactMessage.id,
        name: contactMessage.name,
        email: contactMessage.email,
        subject: contactMessage.subject,
        createdAt: contactMessage.createdAt,
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

    console.error('Create contact message error:', error);
    res.status(500).json({
      error: 'Failed to send message',
      message: 'Internal server error',
    });
  }
};

// Get all contact messages (admin only)
export const getContactMessages = async (req: Request, res: Response) => {
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
    const unreadOnly = req.query.unread === 'true';
    const offset = (page - 1) * limit;

    const where: any = {};
    if (unreadOnly) where.isRead = false;

    const messages = await prisma.contactMessage.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit,
    });

    const totalMessages = await prisma.contactMessage.count({ where });

    const stats = await prisma.contactMessage.aggregate({
      _count: {
        id: true,
      },
      where: { isRead: false },
    });

    res.status(200).json({
      messages,
      pagination: {
        page,
        limit,
        total: totalMessages,
        pages: Math.ceil(totalMessages / limit),
      },
      stats: {
        unreadCount: stats._count.id,
        totalCount: totalMessages,
      },
    });
  } catch (error) {
    console.error('Get contact messages error:', error);
    res.status(500).json({
      error: 'Failed to get contact messages',
      message: 'Internal server error',
    });
  }
};

// Get contact message by ID (admin only)
export const getContactMessageById = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;

    const message = await prisma.contactMessage.findUnique({
      where: { id: id as string },
    });

    if (!message) {
      res.status(404).json({
        error: 'Message not found',
        message: 'The requested contact message does not exist',
      });
      return;
    }

    // Mark as read when viewed
    if (!message.isRead) {
      await prisma.contactMessage.update({
        where: { id: id as string },
        data: { isRead: true },
      });
    }

    res.status(200).json({ message });
  } catch (error) {
    console.error('Get contact message error:', error);
    res.status(500).json({
      error: 'Failed to get contact message',
      message: 'Internal server error',
    });
  }
};

// Update contact message (admin only)
export const updateContactMessage = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;
    const validatedData = UpdateContactMessageSchema.parse(req.body);

    const existingMessage = await prisma.contactMessage.findUnique({
      where: { id: id as string },
    });

    if (!existingMessage) {
      res.status(404).json({
        error: 'Message not found',
        message: 'The requested contact message does not exist',
      });
      return;
    }

    const updatedMessage = await prisma.contactMessage.update({
      where: { id: id as string },
      data: validatedData,
    });

    res.status(200).json({
      message: 'Contact message updated successfully',
      contactMessage: updatedMessage,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Update contact message error:', error);
    res.status(500).json({
      error: 'Failed to update contact message',
      message: 'Internal server error',
    });
  }
};

// Delete contact message (admin only)
export const deleteContactMessage = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const id = req.params.id as string;

    const existingMessage = await prisma.contactMessage.findUnique({
      where: { id: id as string },
    });

    if (!existingMessage) {
      res.status(404).json({
        error: 'Message not found',
        message: 'The requested contact message does not exist',
      });
      return;
    }

    await prisma.contactMessage.delete({
      where: { id: id as string },
    });

    res.status(200).json({
      message: 'Contact message deleted successfully',
    });
  } catch (error) {
    console.error('Delete contact message error:', error);
    res.status(500).json({
      error: 'Failed to delete contact message',
      message: 'Internal server error',
    });
  }
};

// Mark multiple messages as read (admin only)
export const markMessagesAsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const { messageIds } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'messageIds array is required',
      });
      return;
    }

    const updatedCount = await prisma.contactMessage.updateMany({
      where: {
        id: { in: messageIds },
      },
      data: {
        isRead: true,
      },
    });

    res.status(200).json({
      message: `${updatedCount.count} messages marked as read`,
      updatedCount: updatedCount.count,
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({
      error: 'Failed to mark messages as read',
      message: 'Internal server error',
    });
  }
};