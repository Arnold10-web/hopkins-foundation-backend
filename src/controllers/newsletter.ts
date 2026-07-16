import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../utils/database';
import { emailService } from '../services/emailService';

// Validation schemas
const NewsletterSubscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  preferences: z.array(z.string()).default([]),
});

// Subscribe to newsletter
export const subscribeNewsletter = async (req: Request, res: Response) => {
  try {
    const validatedData = NewsletterSubscribeSchema.parse(req.body);

    // Check if email already exists
    const existingSubscriber = await prisma.newsletter.findUnique({
      where: { email: validatedData.email },
    });

    if (existingSubscriber) {
      if (existingSubscriber.isSubscribed) {
        res.status(409).json({
          error: 'Already subscribed',
          message: 'This email is already subscribed to our newsletter',
        });
        return;
      } else {
        // Reactivate subscription
        const updatedSubscriber = await prisma.newsletter.update({
          where: { email: validatedData.email },
          data: {
            isSubscribed: true,
            preferences: validatedData.preferences,
            subscribedAt: new Date(),
            unsubscribedAt: null,
          },
        });

        // Send welcome email
        try {
          await emailService.subscribeToNewsletter({
            email: validatedData.email,
            firstName: 'Valued',
            lastName: 'Subscriber',
            interests: validatedData.preferences
          });
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
          // Don't fail the subscription for email errors
        }

        res.status(200).json({
          message: 'Successfully resubscribed to newsletter',
          subscriber: {
            email: updatedSubscriber.email,
            subscribedAt: updatedSubscriber.subscribedAt,
            preferences: updatedSubscriber.preferences,
          },
        });
        return;
      }
    }

    // Create new subscription
    const subscriber = await prisma.newsletter.create({
      data: {
        email: validatedData.email,
        preferences: validatedData.preferences,
        isSubscribed: true,
      },
    });

    // Send welcome email
    try {
      await emailService.subscribeToNewsletter({
        email: validatedData.email,
        firstName: 'Valued',
        lastName: 'Subscriber',
        interests: validatedData.preferences
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail the subscription for email errors
    }

    res.status(201).json({
      message: 'Successfully subscribed to newsletter',
      subscriber: {
        email: subscriber.email,
        subscribedAt: subscriber.subscribedAt,
        preferences: subscriber.preferences,
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

    console.error('Newsletter subscription error:', error);
    res.status(500).json({
      error: 'Subscription failed',
      message: 'Internal server error',
    });
  }
};

// Unsubscribe from newsletter
export const unsubscribeNewsletter = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Validate email format
    const emailSchema = z.string().email();
    const validatedEmail = emailSchema.parse(email);

    const subscriber = await prisma.newsletter.findUnique({
      where: { email: validatedEmail },
    });

    if (!subscriber) {
      res.status(404).json({
        error: 'Subscriber not found',
        message: 'Email address not found in our newsletter list',
      });
      return;
    }

    if (!subscriber.isSubscribed) {
      res.status(200).json({
        message: 'Already unsubscribed',
        status: 'not_subscribed',
      });
      return;
    }

    // Update subscription status
    await prisma.newsletter.update({
      where: { email: validatedEmail },
      data: {
        isSubscribed: false,
        unsubscribedAt: new Date(),
      },
    });

    res.status(200).json({
      message: 'Successfully unsubscribed from newsletter',
      status: 'unsubscribed',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid email address',
        message: 'Please provide a valid email address',
      });
      return;
    }

    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({
      error: 'Unsubscribe failed',
      message: 'Internal server error',
    });
  }
};

// Get newsletter subscribers (admin only)
export const getNewsletterSubscribers = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const subscribed = req.query.subscribed === 'true';
    const offset = (page - 1) * limit;

    // Fixed: Use Prisma type instead of any
    const where: Prisma.NewsletterWhereInput = {};
    if (subscribed) where.isSubscribed = true;

    const subscribers = await prisma.newsletter.findMany({
      where,
      orderBy: {
        subscribedAt: 'desc',
      },
      skip: offset,
      take: limit,
    });

    const totalSubscribers = await prisma.newsletter.count({ where });

    const stats = await prisma.newsletter.aggregate({
      _count: {
        id: true,
      },
      where: { isSubscribed: true },
    });

    res.status(200).json({
      subscribers,
      pagination: {
        page,
        limit,
        total: totalSubscribers,
        pages: Math.ceil(totalSubscribers / limit),
      },
      stats: {
        activeSubscribers: stats._count.id,
        totalRecords: totalSubscribers,
      },
    });
  } catch (error) {
    console.error('Get newsletter subscribers error:', error);
    res.status(500).json({
      error: 'Failed to get subscribers',
      message: 'Internal server error',
    });
  }
};

// Update subscriber preferences (admin only)
export const updateSubscriberPreferences = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    // Fixed: Explicitly cast to string
    const email = req.params.email as string;
    const { preferences, isSubscribed } = req.body;

    // Fixed: Use Prisma type instead of any
    const updateData: Prisma.NewsletterUpdateInput = {};
    if (preferences !== undefined) updateData.preferences = preferences;
    if (isSubscribed !== undefined) {
      updateData.isSubscribed = isSubscribed;
      if (!isSubscribed) {
        updateData.unsubscribedAt = new Date();
      } else {
        updateData.unsubscribedAt = null;
      }
    }

    const subscriber = await prisma.newsletter.update({
      where: { email },
      data: updateData,
    });

    res.status(200).json({
      message: 'Subscriber preferences updated successfully',
      subscriber,
    });
  } catch (error) {
    console.error('Update subscriber preferences error:', error);
    res.status(500).json({
      error: 'Failed to update subscriber preferences',
      message: 'Internal server error',
    });
  }
};

// Delete subscriber (admin only)
export const deleteSubscriber = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    // Fixed: Explicitly cast to string
    const email = req.params.email as string;

    const existingSubscriber = await prisma.newsletter.findUnique({
      where: { email },
    });

    if (!existingSubscriber) {
      res.status(404).json({
        error: 'Subscriber not found',
        message: 'The requested subscriber does not exist',
      });
      return;
    }

    await prisma.newsletter.delete({
      where: { email },
    });

    res.status(200).json({
      message: 'Subscriber deleted successfully',
    });
  } catch (error) {
    console.error('Delete subscriber error:', error);
    res.status(500).json({
      error: 'Failed to delete subscriber',
      message: 'Internal server error',
    });
  }
};

// Send newsletter to all active subscribers (Admin only)
export const sendNewsletter = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const { subject, message } = req.body;

    if (!subject || !message) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Subject and message are required',
      });
      return;
    }

    // Get all active subscribers
    const subscribers = await prisma.newsletter.findMany({
      where: {
        isSubscribed: true,
      },
    });

    if (subscribers.length === 0) {
      res.status(400).json({
        error: 'No subscribers',
        message: 'There are no active subscribers to send to',
      });
      return;
    }

    // Send email to each subscriber in batches
    const batchSize = 10;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (subscriber) => {
        try {
          await emailService.sendCustomEmail({
            to: subscriber.email,
            subject,
            text: message,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                  <h1 style="color: #333; margin: 0;">Hopkins Foundation</h1>
                </div>
                <div style="padding: 30px 20px;">
                  <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">
                    ${message.replace(/\n/g, '<br>')}
                  </div>
                </div>
                <div style="background-color: #f8f9fa; padding: 20px; text-center; font-size: 12px; color: #666;">
                  <p>You're receiving this because you subscribed to our newsletter.</p>
                  <p style="margin-top: 10px;">
                    <a href="${process.env.FRONTEND_URL || 'https://hopkinsfoundation.org'}/unsubscribe?email=${encodeURIComponent(subscriber.email)}" 
                       style="color: #666; text-decoration: underline;">
                      Unsubscribe
                    </a>
                  </p>
                </div>
              </div>
            `,
          });
          return { email: subscriber.email, success: true };
        } catch (error) {
          console.error(`Failed to send to ${subscriber.email}:`, error);
          return { email: subscriber.email, success: false };
        }
      });

      const results = await Promise.all(batchPromises);
      successCount += results.filter((r) => r.success).length;
      failureCount += results.filter((r) => !r.success).length;
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < subscribers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    res.status(200).json({
      message: 'Newsletter sent',
      stats: {
        total: subscribers.length,
        successful: successCount,
        failed: failureCount,
      },
    });
  } catch (error) {
    console.error('Send newsletter error:', error);
    res.status(500).json({
      error: 'Failed to send newsletter',
      message: 'Internal server error',
    });
  }
};