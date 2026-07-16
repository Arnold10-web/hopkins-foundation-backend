import express, { Request, Response } from 'express';
import crypto from 'crypto';

const router = express.Router();

// ===== SendGrid Event Webhook =====

interface SendGridEvent {
  email: string;
  timestamp: number;
  event: 'processed' | 'delivered' | 'open' | 'click' | 'bounce' | 'dropped' | 'spamreport' | 'unsubscribe' | 'group_unsubscribe' | 'group_resubscribe';
  category?: string[];
  sg_event_id: string;
  sg_message_id: string;
  reason?: string;
  status?: string;
  response?: string;
  url?: string;
  useragent?: string;
  ip?: string;
}

/**
 * Verify SendGrid webhook signature
 * @param req Express request object
 * @returns object with isValid boolean and shouldLog boolean
 */
function verifySendGridSignature(req: Request): { isValid: boolean; shouldLog: boolean } {
  // If no webhook verification token is configured, skip verification (development mode)
  const verificationToken = process.env.SENDGRID_WEBHOOK_VERIFICATION_TOKEN || process.env.SENDGRID_WEBHOOK_SECRET;
  if (!verificationToken) {
    // Only warn once about missing token
    if (!(global as any).sendgridTokenWarningShown) {
      console.warn('⚠️  SENDGRID_WEBHOOK_VERIFICATION_TOKEN not set - signature verification disabled');
      (global as any).sendgridTokenWarningShown = true;
    }
    return { isValid: true, shouldLog: false }; // Accept without verification
  }

  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;

  if (!signature || !timestamp) {
    // Only log once about missing headers
    if (!(global as any).sendgridHeadersWarningShown) {
      console.error('❌ Missing SendGrid signature headers - rejecting webhook');
      (global as any).sendgridHeadersWarningShown = true;
    }
    return { isValid: false, shouldLog: false }; // Reject but don't spam logs
  }

  try {
    // Construct the payload that SendGrid signed
    const payload = timestamp + JSON.stringify(req.body);
    
    // Calculate expected signature using the verification token
    const expectedSignature = crypto
      .createHmac('sha256', verificationToken)
      .update(payload)
      .digest('base64');

    // Compare signatures
    const isValid = signature === expectedSignature;
    
    if (!isValid) {
      // Only log on first failure to avoid log spam
      if (!(global as any).sendgridSignatureMismatchShown) {
        console.warn('⚠️  SendGrid webhook signature mismatch - rejecting request');
        console.warn('   This is expected during initial setup. Configure webhook verification in SendGrid dashboard.');
        (global as any).sendgridSignatureMismatchShown = true;
      }
      return { isValid: false, shouldLog: false }; // Reject with one-time warning
    }
    
    return { isValid: true, shouldLog: false }; // Valid signature
  } catch (error) {
    // Only log once
    if (!(global as any).sendgridSignatureErrorShown) {
      console.error('❌ Error verifying SendGrid signature:', error);
      (global as any).sendgridSignatureErrorShown = true;
    }
    return { isValid: false, shouldLog: false }; // Reject on error
  }
}

/**
 * @route POST /api/webhooks/sendgrid
 * @description Handle SendGrid email events (delivery, opens, clicks, bounces)
 * @access Public (SendGrid webhook)
 * 
 * Events tracked:
 * - processed: Email processed by SendGrid
 * - delivered: Email successfully delivered
 * - open: Recipient opened the email
 * - click: Recipient clicked a link
 * - bounce: Email bounced
 * - dropped: SendGrid dropped the email
 * - spamreport: Recipient marked as spam
 * - unsubscribe: Recipient unsubscribed
 */
router.post('/sendgrid', async (req: Request, res: Response): Promise<void> => {
  try {
    // Verify webhook signature (proper security check)
    const { isValid, shouldLog } = verifySendGridSignature(req);
    
    if (!isValid) {
      // Reject invalid signatures for security
      // One-time warning already logged in verifySendGridSignature()
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    const events: SendGridEvent[] = req.body;

    if (!Array.isArray(events)) {
      res.status(400).json({ error: 'Invalid webhook payload' });
      return;
    }

    // Process each event
    for (const event of events) {
      console.log('📧 SendGrid Event:', {
        event: event.event,
        email: event.email,
        timestamp: new Date(event.timestamp * 1000).toISOString(),
        messageId: event.sg_message_id,
      });

      // Handle different event types
      switch (event.event) {
        case 'delivered':
          console.log('✅ Email delivered:', event.email);
          // TODO: Update database - mark email as delivered
          break;

        case 'open':
          console.log('👀 Email opened:', event.email);
          // TODO: Track email opens in analytics
          break;

        case 'click':
          console.log('🖱️  Link clicked:', event.email, '→', event.url);
          // TODO: Track link clicks
          break;

        case 'bounce':
          console.log('⚠️  Email bounced:', event.email, 'Reason:', event.reason);
          // TODO: Mark email as invalid, update user status
          break;

        case 'dropped':
          console.log('🚫 Email dropped:', event.email, 'Reason:', event.reason);
          // TODO: Handle dropped emails
          break;

        case 'spamreport':
          console.log('⚠️  Spam report:', event.email);
          // TODO: Handle spam complaints, unsubscribe user
          break;

        case 'unsubscribe':
          console.log('👋 Unsubscribed:', event.email);
          // TODO: Update user preferences, mark as unsubscribed
          break;

        default:
          console.log('ℹ️  Other event:', event.event, event.email);
      }
    }

    // Always respond with 200 OK to acknowledge receipt
    res.status(200).json({ received: events.length });
  } catch (error) {
    console.error('❌ SendGrid webhook error:', error);
    // Still return 200 to prevent SendGrid from retrying
    res.status(200).json({ error: 'Internal error' });
  }
});

/**
 * @route GET /api/webhooks/sendgrid/test
 * @description Test endpoint to verify webhook is working
 * @access Public
 */
router.get('/sendgrid/test', (_req: Request, res: Response): void => {
  res.json({
    status: 'OK',
    message: 'SendGrid webhook endpoint is active',
    url: '/api/webhooks/sendgrid',
    timestamp: new Date().toISOString(),
  });
});

export default router;