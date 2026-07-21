import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import prisma from '../utils/database';
import { emailService } from '../services/emailService';
import { deleteUploadedFile } from '../utils/fileUtils';

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const UpdateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  profileImage: z.string().optional(),
});

// Helper function to generate JWT token
const generateToken = (userId: string, email: string, role: string): string => {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  const payload = { userId, email, role };
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
};

// Register new user
export const register = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = RegisterSchema.parse(req.body);
    const email = validatedData.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
      },
    });

    if (existingUser) {
      res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(validatedData.password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        role: 'MEMBER',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        memberSince: true,
      },
    });

    // Generate token
    const token = generateToken(user.id, user.email, user.role);

    // Send welcome email (async, don't block registration)
    emailService.sendEmailVerification(user.email, token)
      .then(() => console.log('✅ Welcome email sent to:', user.email))
      .catch(error => console.error('❌ Failed to send welcome email:', error));

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error',
    });
  }
};

// Login user
export const login = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = LoginSchema.parse(req.body);
    const email = validatedData.email.trim().toLowerCase();

    // Find user (email is stored lowercase; also try exact match for legacy rows)
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user && email !== validatedData.email) {
      user = await prisma.user.findUnique({
        where: { email: validatedData.email.trim() },
      });
    }

    // Case-insensitive fallback for accounts created before email normalization
    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
        },
      });
    }

    if (!user) {
      res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
      return;
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate token
    const token = generateToken(user.id, user.email, user.role);

    // Return user data (without password)
    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      memberSince: user.memberSince,
    };

    res.status(200).json({
      message: 'Login successful',
      user: userResponse,
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error',
    });
  }
};

// Get user profile
export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
        _count: {
          select: {
            donations: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        error: 'User not found',
        message: 'User profile not found',
      });
      return;
    }

    // Calculate total donations
    const donationStats = await prisma.donation.aggregate({
      where: {
        userId: user.id,
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
    });

    const profileData = {
      ...user,
      stats: {
        totalDonations: donationStats._sum.amount || 0,
        donationCount: user._count.donations,
      },
    };

    res.status(200).json({
      user: profileData,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: 'Internal server error',
    });
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    // Validate input
    const validatedData = UpdateProfileSchema.parse(req.body);

    // Delete old profile image if a new one is being uploaded
    if (validatedData.profileImage) {
      const existingUser = await prisma.user.findUnique({ 
        where: { id: req.user.id },
        select: { profileImage: true }
      });
      if (existingUser?.profileImage && existingUser.profileImage !== validatedData.profileImage) {
        await deleteUploadedFile(existingUser.profileImage);
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: validatedData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        memberSince: true,
        profileImage: true,
      },
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
      return;
    }

    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: 'Internal server error',
    });
  }
};

// Logout (client-side token removal, but we can track this)
export const logout = async (req: Request, res: Response) => {
  try {
    // In a more complex setup, you might invalidate the token in a blacklist
    // For now, we'll just send a success response
    res.status(200).json({
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'Internal server error',
    });
  }
};

// Change password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).user?.id; // From auth middleware

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate input
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      res.status(400).json({ error: 'New password must be different from current password' });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

// Forgot password - generate reset token and send email
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      res.status(200).json({ 
        message: 'If an account with that email exists, a password reset link has been sent' 
      });
      return;
    }

    // Generate reset token (random string)
    const resetToken = randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // Store reset token in database (expires in 1 hour)
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    // Send password reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${email}`;
    await emailService.sendPasswordResetEmail(user.email, resetUrl);

    res.status(200).json({ 
      message: 'If an account with that email exists, a password reset link has been sent' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reset password - verify token and update password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, newPassword } = req.body;
    let token = req.body.token;

    // URL decode the token in case it was encoded
    if (token) {
      token = decodeURIComponent(token);
    }

    if (!token || !email || !newPassword) {
      res.status(400).json({ message: 'Token, email, and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        passwordResets: {
          where: {
            used: false,
            expiresAt: {
              gt: new Date(), // Not expired
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!user || user.passwordResets.length === 0) {
      res.status(400).json({ message: 'Invalid or expired reset token' });
      return;
    }

    // Verify token matches one of the valid reset tokens
    let validToken = null;
    for (const reset of user.passwordResets) {
      const isValid = await bcrypt.compare(token, reset.token);
      if (isValid) {
        validToken = reset;
        break;
      }
    }

    if (!validToken) {
      res.status(400).json({ message: 'Invalid or expired reset token' });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.passwordReset.update({
        where: { id: validToken.id },
        data: { used: true },
      }),
    ]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};