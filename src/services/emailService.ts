import sgMail from '@sendgrid/mail';

// SendGrid configuration - Templates are REQUIRED
const SENDGRID_CONFIG = {
  apiKey: process.env.SENDGRID_API_KEY || '',
  fromEmail: process.env.FROM_EMAIL || 'noreply@hopkinsfoundation.org',
  replyToEmail: process.env.REPLY_TO_EMAIL || process.env.FROM_EMAIL || 'info@hopkinsfoundation.org',
  templates: {
    welcome: process.env.WELCOME_TEMPLATE_ID,
    donation_receipt: process.env.RECEIPT_TEMPLATE_ID,
    newsletter_welcome: process.env.NEWSLETTER_WELCOME_TEMPLATE_ID,
    monthly_newsletter: process.env.MONTHLY_NEWSLETTER_TEMPLATE_ID
  }
};

// Validate required configuration
if (!SENDGRID_CONFIG.apiKey) {
  console.warn('⚠️ WARNING: SENDGRID_API_KEY is not configured. Email functionality will be disabled.');
}

// Validate template IDs (warn if missing, don't throw)
if (!SENDGRID_CONFIG.templates.welcome) {
  console.warn('⚠️ WARNING: WELCOME_TEMPLATE_ID is not configured. Welcome emails will be disabled.');
}

if (!SENDGRID_CONFIG.templates.donation_receipt) {
  console.warn('⚠️ WARNING: RECEIPT_TEMPLATE_ID is not configured. Donation receipt emails will be disabled.');
}

if (!SENDGRID_CONFIG.templates.newsletter_welcome) {
  console.warn('⚠️ WARNING: NEWSLETTER_WELCOME_TEMPLATE_ID is not configured. Newsletter welcome emails will be disabled.');
}

// Initialize SendGrid if API key exists
if (SENDGRID_CONFIG.apiKey) {
  sgMail.setApiKey(SENDGRID_CONFIG.apiKey);
  console.log('✅ SendGrid initialized successfully');
  
  const configuredTemplates = Object.entries(SENDGRID_CONFIG.templates)
    .filter(([_templateId, id]) => id)
    .map(([name]) => name);
  
  if (configuredTemplates.length > 0) {
    console.log('✅ Configured email templates:', configuredTemplates.join(', '));
  }
} else {
  console.warn('⚠️ SendGrid not initialized - email functionality disabled');
}

export interface DonationReceiptData {
  donorName: string;
  donorEmail: string;
  donationAmount: number;
  donationDate: Date;
  transactionId: string;
  taxDeductible: boolean;
  organizationTaxId: string;
  organizationAddress: string;
}

export interface NewsletterSubscriber {
  email: string;
  firstName?: string;
  lastName?: string;
  interests?: string[];
}

export class EmailService {
  
  /**
   * Send welcome email to new donors using SendGrid template (REQUIRED)
   */
  async sendWelcomeEmail(donorEmail: string, donorName: string, donationAmount: number): Promise<boolean> {
    try {
      if (!SENDGRID_CONFIG.apiKey) {
        console.warn('⚠️ SendGrid not configured - skipping welcome email');
        return false;
      }

      if (!SENDGRID_CONFIG.templates.welcome) {
        console.warn('⚠️ Welcome email template not configured - skipping welcome email');
        return false;
      }

      const impactStats = this.calculateImpact(donationAmount);
      
      const msg = {
        to: donorEmail,
        from: SENDGRID_CONFIG.fromEmail,
        replyTo: SENDGRID_CONFIG.replyToEmail,
        templateId: SENDGRID_CONFIG.templates.welcome!,
        dynamicTemplateData: {
          donor_name: donorName,
          donation_amount: donationAmount,
          students_helped: impactStats.students,
          women_supported: impactStats.women,
          dashboard_url: `${process.env.FRONTEND_URL}/dashboard`,
          organization_name: 'Hopkins Foundation',
          current_year: new Date().getFullYear()
        }
      };

      await sgMail.send(msg);
      console.log('✅ Welcome email sent via SendGrid template to:', donorEmail);
      return true;
    } catch (error) {
      console.error('❌ Error sending welcome email:', error);
      return false;
    }
  }

  /**
   * Send donation receipt using SendGrid template (REQUIRED)
   */
  async sendDonationReceipt(receiptData: DonationReceiptData): Promise<boolean> {
    try {
      const msg = {
        to: receiptData.donorEmail,
        from: SENDGRID_CONFIG.fromEmail,
        replyTo: SENDGRID_CONFIG.replyToEmail,
        templateId: SENDGRID_CONFIG.templates.donation_receipt!,
        dynamicTemplateData: {
          donor_name: receiptData.donorName,
          donation_amount: receiptData.donationAmount,
          donation_date: receiptData.donationDate.toLocaleDateString(),
          transaction_id: receiptData.transactionId,
          tax_deductible: receiptData.taxDeductible,
          organization_tax_id: receiptData.organizationTaxId,
          organization_address: receiptData.organizationAddress,
          current_year: new Date().getFullYear()
        }
      };

      await sgMail.send(msg);
      console.log('✅ Donation receipt sent via SendGrid template to:', receiptData.donorEmail);
      return true;
    } catch (error) {
      console.error('❌ Error sending donation receipt:', error);
      return false;
    }
  }

  /**
   * Subscribe to newsletter using SendGrid Marketing
   */
  async subscribeToNewsletter(subscriber: NewsletterSubscriber): Promise<boolean> {
    try {
      if (!SENDGRID_CONFIG.apiKey) {
        console.warn('⚠️ SendGrid not configured - skipping newsletter subscription email');
        return false;
      }

      if (!SENDGRID_CONFIG.templates.newsletter_welcome) {
        console.warn('⚠️ Newsletter welcome template not configured - skipping welcome email');
        return false;
      }

      // Add contact to SendGrid Marketing Contacts
      const contactData = {
        contacts: [{
          email: subscriber.email,
          first_name: subscriber.firstName || '',
          last_name: subscriber.lastName || '',
          custom_fields: {
            signup_source: 'website',
            member_status: 'active',
            interests: subscriber.interests?.join(',') || '',
            signup_date: new Date().toISOString()
          }
        }]
      };

      // Add to SendGrid contacts list
      const contactResponse = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${SENDGRID_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contactData)
      });

      if (!contactResponse.ok) {
        const errorText = await contactResponse.text();
        console.error('❌ Failed to add contact to SendGrid:', errorText);
        // Continue to send welcome email even if contact list addition fails
      } else {
        console.log('✅ Added contact to SendGrid marketing list:', subscriber.email);
      }

      // Send welcome email using required template
      const welcomeMsg = {
        to: subscriber.email,
        from: SENDGRID_CONFIG.fromEmail,
        replyTo: SENDGRID_CONFIG.replyToEmail,
        templateId: SENDGRID_CONFIG.templates.newsletter_welcome!,
        dynamicTemplateData: {
          first_name: subscriber.firstName || 'Friend',
          subscription_preferences: subscriber.interests?.join(', ') || 'All updates',
          unsubscribe_url: `${process.env.FRONTEND_URL}/unsubscribe`,
          current_year: new Date().getFullYear()
        }
      };

      await sgMail.send(welcomeMsg);
      console.log('✅ Newsletter welcome email sent via SendGrid to:', subscriber.email);

      return true;
    } catch (error) {
      console.error('❌ Error subscribing to newsletter:', error);
      return false;
    }
  }

  /**
   * Send monthly impact newsletter using SendGrid Marketing
   */
  async sendMonthlyNewsletter(listId: string, impactData: any): Promise<boolean> {
    try {
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      // Create Single Send campaign using template
      const campaignData = {
        name: `Monthly Impact Report - ${currentMonth}`,
        send_to: {
          list_ids: [listId]
        },
        email_config: {
          subject: `Your Monthly Impact Report - ${currentMonth} 📊`,
          template_id: SENDGRID_CONFIG.templates.newsletter_welcome!,
          sender_id: parseInt(process.env.SENDGRID_SENDER_ID || '0'),
          suppression_group_id: parseInt(process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID || '0'),
          custom_unsubscribe_url: `${process.env.FRONTEND_URL}/unsubscribe`,
          substitutions: {
            month_year: currentMonth,
            impact_data: JSON.stringify(impactData || {}),
            dashboard_url: `${process.env.FRONTEND_URL}/dashboard`,
            stories_url: `${process.env.FRONTEND_URL}/stories`
          }
        }
      };

      const response = await fetch('https://api.sendgrid.com/v3/marketing/singlesends', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(campaignData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create newsletter campaign: ${errorText}`);
      }

      const campaign = await response.json() as { id: string };
      
      // Schedule send immediately
      const scheduleResponse = await fetch(`https://api.sendgrid.com/v3/marketing/singlesends/${campaign.id}/schedule`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${SENDGRID_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ send_at: 'now' })
      });

      if (scheduleResponse.ok) {
        console.log('✅ Monthly newsletter campaign sent via SendGrid Marketing');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error sending monthly newsletter:', error);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(userEmail: string, resetUrl: string): Promise<boolean> {
    try {
      const msg = {
        to: userEmail,
        from: SENDGRID_CONFIG.fromEmail,
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject: 'Reset Your Hopkins Foundation Account Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${resetUrl}" style="background: #ef4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px;">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
        text: `Reset your password: ${resetUrl}\n\nThis link will expire in 1 hour.\nIf you didn't request this, please ignore this email.`
      };

      await sgMail.send(msg);
      console.log('✅ Password reset email sent to:', userEmail);
      return true;
    } catch (error) {
      console.error('❌ Error sending password reset email:', error);
      return false;
    }
  }

  /**
   * Send email verification email (welcome email on signup)
   */
  async sendEmailVerification(email: string, verificationToken: string): Promise<boolean> {
    try {
      if (!SENDGRID_CONFIG.apiKey) {
        console.warn('⚠️ SendGrid not configured - skipping email verification');
        return false;
      }

      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      
      const msg = {
        to: email,
        from: SENDGRID_CONFIG.fromEmail,
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject: 'Welcome to Hopkins Foundation! 🎉',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: #059669; margin-bottom: 20px;">Welcome to Hopkins Foundation! 🌍</h1>
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                Thank you for joining the <strong>Hopkins Foundation</strong> community! 
                We're excited to have you on this journey of empowering African youth and women through education.
              </p>
              
              <div style="margin: 30px 0; text-align: center;">
                <a href="${verificationUrl}" style="background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Verify Your Email
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280;">
                This link will expire in 24 hours for security reasons.
              </p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">
                  <strong>What's next?</strong>
                </p>
                <ul style="font-size: 14px; color: #6b7280; line-height: 1.8;">
                  <li>Explore our programs and impact stories</li>
                  <li>Connect with our community</li>
                  <li>Make a difference through donations and volunteering</li>
                </ul>
              </div>
              
              <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">
                If you didn't create this account, please ignore this email.
              </p>
            </div>
          </div>
        `,
        text: `Welcome to Hopkins Foundation!

Thank you for joining the Hopkins Foundation community!

Verify your email: ${verificationUrl}

This link will expire in 24 hours.

If you didn't create this account, please ignore this email.

---
Hopkins Foundation
Empowering through Education`
      };

      await sgMail.send(msg);
      console.log('✅ Welcome email sent via SendGrid to:', email);
      return true;
    } catch (error) {
      console.error('❌ Error sending welcome email:', error);
      return false;
    }
  }

  // Private helper methods

  /**
   * Calculate impact based on donation amount
   */
  private calculateImpact(amount: number): { students: number; women: number } {
    return {
      students: Math.floor(amount / 25),
      women: Math.floor(amount / 100)
    };
  }

  /**
   * Send custom email (for newsletters, announcements, etc.)
   */
  async sendCustomEmail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<boolean> {
    try {
      if (!SENDGRID_CONFIG.apiKey) {
        console.warn('⚠️ SendGrid not configured - skipping custom email');
        return false;
      }

      const msg = {
        to: options.to,
        from: SENDGRID_CONFIG.fromEmail,
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
      };

      await sgMail.send(msg);
      console.log(`Custom email sent to: ${options.to}`);
      return true;
    } catch (error) {
      console.error('Error sending custom email:', error);
      return false;
    }
  }

  /**
   * Send event registration confirmation email
   */
  async sendEventRegistrationConfirmation(
    email: string, 
    name: string, 
    event: {
      title: string;
      eventDate: Date;
      eventTime: string;
      location?: string | null;
      isVirtual: boolean;
      meetingLink?: string | null;
    }
  ): Promise<boolean> {
    try {
      if (!SENDGRID_CONFIG.apiKey) {
        console.warn('⚠️ SendGrid not configured - skipping event confirmation email');
        return false;
      }

      const eventDateFormatted = new Date(event.eventDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const locationInfo = event.isVirtual 
        ? `<p><strong>Virtual Event</strong><br>${event.meetingLink ? `Meeting Link: <a href="${event.meetingLink}">${event.meetingLink}</a>` : 'Meeting link will be sent before the event'}</p>`
        : `<p><strong>Location:</strong> ${event.location || 'TBD'}</p>`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background: #fff;
              padding: 30px 20px;
              border: 1px solid #e0e0e0;
              border-top: none;
            }
            .event-details {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .event-details h3 {
              margin-top: 0;
              color: #667eea;
            }
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 14px;
              border-top: 1px solid #e0e0e0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>✓ Event Registration Confirmed!</h1>
          </div>
          
          <div class="content">
            <p>Hi ${name},</p>
            
            <p>Thank you for registering! We're excited to confirm your registration for:</p>
            
            <div class="event-details">
              <h3>${event.title}</h3>
              <p><strong>📅 Date:</strong> ${eventDateFormatted}</p>
              <p><strong>🕐 Time:</strong> ${event.eventTime}</p>
              ${locationInfo}
            </div>
            
            <p><strong>What's Next?</strong></p>
            <ul>
              <li>Add this event to your calendar</li>
              <li>We'll send you a reminder 24 hours before the event</li>
              ${event.isVirtual ? '<li>The meeting link will be included in the reminder email</li>' : ''}
              <li>If you have any questions, feel free to reply to this email</li>
            </ul>
            
            <p>We look forward to seeing you at the event!</p>
            
            <a href="${process.env.FRONTEND_URL}/events" class="button">View All Events</a>
            
            <p>Best regards,<br><strong>Hopkins Foundation</strong></p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hopkins Foundation. All rights reserved.</p>
            <p>If you didn't register for this event, please contact us immediately.</p>
          </div>
        </body>
        </html>
      `;

      const text = `
Event Registration Confirmed!

Hi ${name},

Thank you for registering! We're excited to confirm your registration for:

${event.title}

📅 Date: ${eventDateFormatted}
🕐 Time: ${event.eventTime}
${event.isVirtual ? `💻 Virtual Event\n${event.meetingLink ? `Meeting Link: ${event.meetingLink}` : 'Meeting link will be sent before the event'}` : `📍 Location: ${event.location || 'TBD'}`}

What's Next?
- Add this event to your calendar
- We'll send you a reminder 24 hours before the event
${event.isVirtual ? '- The meeting link will be included in the reminder email' : ''}
- If you have any questions, feel free to reply to this email

We look forward to seeing you at the event!

Best regards,
Hopkins Foundation

---
© ${new Date().getFullYear()} Hopkins Foundation. All rights reserved.
If you didn't register for this event, please contact us immediately.
      `;

      const msg = {
        to: email,
        from: SENDGRID_CONFIG.fromEmail,
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject: `Registration Confirmed: ${event.title}`,
        text,
        html,
      };

      await sgMail.send(msg);
      console.log(`✅ Event registration confirmation sent to: ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending event registration confirmation:', error);
      return false;
    }
  }

  /**
   * Send volunteer application status notification (Accepted or Rejected)
   */
  async sendVolunteerStatusNotification(
    email: string,
    firstName: string,
    lastName: string,
    position: string,
    status: 'ACCEPTED' | 'REJECTED',
    reviewNotes?: string
  ): Promise<boolean> {
    if (!SENDGRID_CONFIG.apiKey) {
      console.error('❌ SendGrid API key is not configured');
      return false;
    }

    const isAccepted = status === 'ACCEPTED';
    const fullName = `${firstName} ${lastName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f4;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, ${isAccepted ? '#10b981 0%, #059669 100%' : '#ef4444 0%, #dc2626 100%'}); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Application ${isAccepted ? 'Accepted' : 'Update'}
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.95;">
                Hopkins Foundation
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Dear ${fullName},
              </p>

              ${isAccepted ? `
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                We are thrilled to inform you that your application for the <strong>${position}</strong> position has been <span style="color: #10b981; font-weight: bold;">accepted</span>! 🎉
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                We were impressed by your qualifications, experience, and passion for making a difference. We believe you will be a valuable addition to our team.
              </p>

              ${reviewNotes ? `
              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #166534;">
                  <strong>Message from our team:</strong><br>
                  ${reviewNotes}
                </p>
              </div>
              ` : ''}

              <div style="background-color: #f9fafb; padding: 20px; margin: 25px 0; border-radius: 8px; border: 1px solid #e5e7eb;">
                <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #1f2937;">What's Next?</h3>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.8;">
                  <li>Our team will contact you within 2-3 business days with onboarding details</li>
                  <li>You'll receive information about orientation and training schedules</li>
                  <li>We'll share access to our volunteer resources and community</li>
                  <li>Feel free to reach out if you have any questions in the meantime</li>
                </ul>
              </div>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Welcome to the Hopkins Foundation community! We look forward to working with you to create meaningful impact in communities across Africa.
              </p>
              ` : `
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Thank you for your interest in the <strong>${position}</strong> position with Hopkins Foundation.
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                After careful consideration, we regret to inform you that we will not be moving forward with your application at this time. This decision was difficult, as we received many qualified applications.
              </p>

              ${reviewNotes ? `
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #991b1b;">
                  <strong>Feedback from our team:</strong><br>
                  ${reviewNotes}
                </p>
              </div>
              ` : ''}

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                We encourage you to:
              </p>

              <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #4b5563; line-height: 1.8;">
                <li>Keep an eye on our website for future opportunities</li>
                <li>Consider applying for other positions that match your skills</li>
                <li>Stay connected with our mission and programs</li>
                <li>Continue developing your skills and experience</li>
              </ul>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                We truly appreciate your interest in volunteering with MEC and wish you all the best in your future endeavors.
              </p>
              `}

              <div style="text-align: center; margin: 30px 0;">
                <a href="https://hopkinsfoundation.org/contact" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                  Contact Us
                </a>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Best regards,<br>
                <strong>The Hopkins Foundation Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
                <strong>Hopkins Foundation</strong>
              </p>
              <p style="margin: 0 0 15px 0; font-size: 14px; color: #6b7280;">
                Empowering communities through education, skills development, and sustainability
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                📧 admin@hopkinsfoundation.org | 📞 +256772821261
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">
                Kampala, Uganda
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const text = `
Application ${isAccepted ? 'Accepted' : 'Update'} - Hopkins Foundation

Dear ${fullName},

${isAccepted ? `
We are thrilled to inform you that your application for the ${position} position has been ACCEPTED! 🎉

We were impressed by your qualifications, experience, and passion for making a difference. We believe you will be a valuable addition to our team.

${reviewNotes ? `Message from our team:\n${reviewNotes}\n\n` : ''}

What's Next?
- Our team will contact you within 2-3 business days with onboarding details
- You'll receive information about orientation and training schedules
- We'll share access to our volunteer resources and community
- Feel free to reach out if you have any questions in the meantime

Welcome to the Hopkins Foundation community! We look forward to working with you to create meaningful impact in communities across Africa.
` : `
Thank you for your interest in the ${position} position with Hopkins Foundation.

After careful consideration, we regret to inform you that we will not be moving forward with your application at this time. This decision was difficult, as we received many qualified applications.

${reviewNotes ? `Feedback from our team:\n${reviewNotes}\n\n` : ''}

We encourage you to:
- Keep an eye on our website for future opportunities
- Consider applying for other positions that match your skills
- Stay connected with our mission and programs
- Continue developing your skills and experience

We truly appreciate your interest in volunteering with Hopkins Foundation and wish you all the best in your future endeavors.
`}

Best regards,
The Hopkins Foundation Team

---
Hopkins Foundation
Empowering communities through education, skills development, and sustainability

Email: admin@hopkinsfoundation.org
Phone: +256772821261
Location: Kampala, Uganda
Website: https://hopkinsfoundation.org
    `;

    try {
      const msg = {
        to: email,
        from: SENDGRID_CONFIG.fromEmail,
        replyTo: SENDGRID_CONFIG.replyToEmail,
        subject: `Application ${isAccepted ? 'Accepted' : 'Update'}: ${position}`,
        text,
        html,
      };

      await sgMail.send(msg);
      console.log(`✅ Volunteer ${status.toLowerCase()} notification sent to: ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending volunteer status notification:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default EmailService;