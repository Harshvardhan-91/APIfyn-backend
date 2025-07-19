import express, { Request, Response } from 'express';
import admin from 'firebase-admin';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { prisma } from '../index';
import { createLogger } from '../utils/logger';

const router = express.Router();
const logger = createLogger();

// Verify Firebase ID token and get user info
router.post('/verify', asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body;

  if (!idToken) {
    throw new CustomError('ID token is required', 400);
  }

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
    });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || '',
          displayName: decodedToken.name || null,
          photoURL: decodedToken.picture || null,
          emailVerified: decodedToken.email_verified || false,
          lastLoginAt: new Date(),
        },
      });

      logger.info(`New user created: ${user.email}`);
    } else {
      // Update last login
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    // Return user data (excluding sensitive fields)
    const { firebaseUid, ...userData } = user;
    
    res.json({
      success: true,
      user: userData,
      firebase: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
      },
    });
  } catch (error) {
    logger.error('Token verification failed:', error);
    
    if (process.env.NODE_ENV === 'development') {
      // In development, create a mock user for testing
      const mockUser = {
        id: 'dev-user-id',
        email: 'dev@example.com',
        displayName: 'Development User',
        photoURL: null,
        emailVerified: true,
        role: 'USER' as const,
        subscription: 'FREE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      logger.warn('Development mode: Using mock user');
      res.json({
        success: true,
        user: mockUser,
        firebase: {
          uid: 'dev-uid',
          email: 'dev@example.com',
          emailVerified: true,
        },
        development: true,
      });
      return;
    }
    
    throw new CustomError('Invalid or expired token', 401);
  }
}));

// Refresh user token
router.post('/refresh', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const firebaseUser = req.firebaseUser;

  // Update user data if needed
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName: firebaseUser.name || user.displayName,
      photoURL: firebaseUser.picture || user.photoURL,
      emailVerified: firebaseUser.email_verified || user.emailVerified,
      lastLoginAt: new Date(),
    },
  });

  const { firebaseUid, ...userData } = updatedUser;

  res.json({
    success: true,
    user: userData,
  });
}));

// Sign out (revoke token)
router.post('/signout', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const firebaseUser = req.firebaseUser;

  try {
    // Revoke Firebase token
    await admin.auth().revokeRefreshTokens(firebaseUser.uid);
    
    logger.info(`User signed out: ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Successfully signed out',
    });
  } catch (error) {
    logger.error('Sign out error:', error);
    throw new CustomError('Failed to sign out', 500);
  }
}));

// Delete user account
router.delete('/delete-account', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const firebaseUser = req.firebaseUser;

  try {
    // Delete user from database (cascade will handle related records)
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Delete Firebase user
    await admin.auth().deleteUser(firebaseUser.uid);

    logger.info(`User account deleted: ${user.email}`);

    res.json({
      success: true,
      message: 'Account successfully deleted',
    });
  } catch (error) {
    logger.error('Account deletion error:', error);
    throw new CustomError('Failed to delete account', 500);
  }
}));

// Get current user profile
router.get('/me', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  
  // Get user with additional stats
  const userWithStats = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      _count: {
        select: {
          workflows: true,
          executions: true,
          integrations: true,
        },
      },
    },
  });

  if (!userWithStats) {
    throw new CustomError('User not found', 404);
  }

  const { firebaseUid, ...userData } = userWithStats;

  res.json({
    success: true,
    user: userData,
  });
}));

export default router;
