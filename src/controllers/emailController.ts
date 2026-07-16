import { Request, Response } from 'express';
import { z } from 'zod';
import { emailService } from '../services/emailService';

// Validation schemas
const subscribeNewsletterSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  interests: z.array(z.string()).optional()
});

const sendReceiptSchema = z.object({
  donorName: z.string().min(1, 'Donor name is required'),
  donorEmail: z.string().email('Invalid email address'),
  donationAmount: z.number().positive('Donation amount must be positive'),
  transactionId: z.string().min(1, 'Transaction ID is required'),
  taxDeductible: z.boolean().optional().default(true),
  organizationTaxId: z.string().optional().default('XX-XXXXXXX'),
  organizationAddress: z.string().optional().default('123 Main St, City, State 12345')
});

export class EmailController {
  
  /**
   * Subscribe user to newsletter
   * POST /api/email/newsletter/subscribe
   */
  async subscribeToNewsletter(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = subscribeNewsletterSchema.parse(req.body);
      
      const success = await emailService.subscribeToNewsletter({
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        interests: validatedData.interests
      });

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Successfully subscribed to newsletter'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to subscribe to newsletter'
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues
        });
      } else {
        console.error('Newsletter subscription error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    }
  }

  /**
   * Send donation receipt
   * POST /api/email/receipt
   */
  async sendDonationReceipt(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = sendReceiptSchema.parse(req.body);
      
      const receiptData = {
        donorName: validatedData.donorName,
        donorEmail: validatedData.donorEmail,
        donationAmount: validatedData.donationAmount,
        donationDate: new Date(),
        transactionId: validatedData.transactionId,
        taxDeductible: validatedData.taxDeductible,
        organizationTaxId: validatedData.organizationTaxId,
        organizationAddress: validatedData.organizationAddress
      };

      const success = await emailService.sendDonationReceipt(receiptData);

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Donation receipt sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send donation receipt'
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues
        });
      } else {
        console.error('Receipt sending error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    }
  }

  /**
   * Send welcome email
   * POST /api/email/welcome
   */
  async sendWelcomeEmail(req: Request, res: Response): Promise<Response | void> {
    try {
      const { donorEmail, donorName, donationAmount } = req.body;

      if (!donorEmail || !donorName || !donationAmount) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: donorEmail, donorName, donationAmount'
        });
      }

      const success = await emailService.sendWelcomeEmail(donorEmail, donorName, donationAmount);

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Welcome email sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send welcome email'
        });
      }
    } catch (error) {
      console.error('Welcome email error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Send monthly newsletter to all subscribers
   * POST /api/email/newsletter/monthly
   */
  async sendMonthlyNewsletter(req: Request, res: Response): Promise<Response | void> {
    try {
      const { listId, impactData } = req.body;

      if (!listId) {
        return res.status(400).json({
          success: false,
          message: 'SendGrid list ID is required'
        });
      }

      const success = await emailService.sendMonthlyNewsletter(listId, impactData);

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Monthly newsletter campaign created and sent'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send monthly newsletter'
        });
      }
    } catch (error) {
      console.error('Monthly newsletter error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Send password reset email
   * POST /api/email/password-reset
   */
  async sendPasswordResetEmail(req: Request, res: Response): Promise<Response | void> {
    try {
      const { email, resetToken } = req.body;

      if (!email || !resetToken) {
        return res.status(400).json({
          success: false,
          message: 'Email and reset token are required'
        });
      }

      const success = await emailService.sendPasswordResetEmail(email, resetToken);

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Password reset email sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send password reset email'
        });
      }
    } catch (error) {
      console.error('Password reset email error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Send email verification
   * POST /api/email/verify
   */
  async sendEmailVerification(req: Request, res: Response): Promise<Response | void> {
    try {
      const { email, verificationToken } = req.body;

      if (!email || !verificationToken) {
        return res.status(400).json({
          success: false,
          message: 'Email and verification token are required'
        });
      }

      const success = await emailService.sendEmailVerification(email, verificationToken);

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Email verification sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send email verification'
        });
      }
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Test SendGrid configuration
   * GET /api/email/test
   */
  async testEmailConfiguration(req: Request, res: Response): Promise<Response | void> {
    try {
      const testEmail = req.query.email as string;
      
      if (!testEmail) {
        return res.status(400).json({
          success: false,
          message: 'Test email address is required as query parameter'
        });
      }

      // Send a simple test email
      const success = await emailService.sendWelcomeEmail(testEmail, 'Test User', 100);

      if (success) {
        res.status(200).json({
          success: true,
          message: `Test email sent successfully to ${testEmail}`
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send test email'
        });
      }
    } catch (error) {
      console.error('Email test error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export const emailController = new EmailController();
export default EmailController;