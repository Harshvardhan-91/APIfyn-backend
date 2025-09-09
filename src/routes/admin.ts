import express, { Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../db';

const router = express.Router();

// Get all users (simplified - no role checking for now)
router.get('/users', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // For now, return basic user info without admin restrictions
  // You can add proper admin role checking later
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      emailVerified: true,
      createdAt: true,
      lastLoginAt: true,
    },
    take: 50, // Limit results
  });
  
  res.json({ 
    success: true, 
    users,
    message: 'Admin functionality will be built from scratch'
  });
}));

// Get basic system stats
router.get('/stats', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const totalUsers = await prisma.user.count();
  const totalWorkflows = await prisma.workflow.count();
  const totalExecutions = await prisma.workflowExecution.count();
  const totalIntegrations = await prisma.integration.count();
  
  res.json({
    success: true,
    stats: {
      totalUsers,
      totalWorkflows,
      totalExecutions,
      totalIntegrations,
    },
    message: 'Admin dashboard will be built from scratch'
  });
}));

export default router;
