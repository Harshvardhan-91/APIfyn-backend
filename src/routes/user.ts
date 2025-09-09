import express, { Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../db';
import { createLogger } from '../utils/logger';

const router = express.Router();
const logger = createLogger();

// Get user dashboard data (simplified version)
router.get('/dashboard', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  // Get basic statistics (placeholder values for now)
  const dashboardData = {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    },
    stats: {
      totalWorkflows: 0,
      activeWorkflows: 0,
      totalExecutions: 0,
      totalIntegrations: 0,
    },
    recentActivity: [],
    subscription: {
      type: 'FREE',
      name: 'Free Plan',
      workflowsLimit: 5,
      apiCallsLimit: 100,
      status: 'active',
    }
  };

  res.json({
    success: true,
    data: dashboardData,
  });
}));

// Get user profile
router.get('/profile', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company,
      jobTitle: user.jobTitle,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
  });
}));

// Update user profile
router.put('/profile', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { firstName, lastName, company, jobTitle } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName,
      lastName,
      company,
      jobTitle,
      updatedAt: new Date(),
    },
  });

  res.json({
    success: true,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      company: updatedUser.company,
      jobTitle: updatedUser.jobTitle,
    },
  });
}));

export default router;