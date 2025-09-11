import express, { Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../db';
import { createLogger } from '../utils/logger';

const router = express.Router();
const logger = createLogger();

// Get user dashboard data
router.get('/dashboard', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  try {
    // Get actual workflow statistics from database
    const totalWorkflows = await prisma.workflow.count({
      where: { userId: user.id }
    });

    const activeWorkflows = await prisma.workflow.count({
      where: { 
        userId: user.id,
        isActive: true 
      }
    });

    const totalExecutions = await prisma.workflowExecution.count({
      where: {
        workflow: {
          userId: user.id
        }
      }
    });

    const totalIntegrations = await prisma.integration.count({
      where: { userId: user.id }
    });

    // Get executions today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const executionsToday = await prisma.workflowExecution.count({
      where: {
        workflow: {
          userId: user.id
        },
        startedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Get executions this week
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const executionsThisWeek = await prisma.workflowExecution.count({
      where: {
        workflow: {
          userId: user.id
        },
        startedAt: {
          gte: startOfWeek
        }
      }
    });

    // Get recent workflow executions
    const recentActivity = await prisma.workflowExecution.findMany({
      where: {
        workflow: {
          userId: user.id
        }
      },
      include: {
        workflow: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: 5
    });

    const dashboardData = {
      totalWorkflows,
      executionsToday,
      connectedApps: totalIntegrations,
      thisWeek: executionsThisWeek,
      recentActivity: recentActivity.map(execution => ({
        id: execution.id,
        type: 'workflow_execution',
        description: `Workflow "${execution.workflow.name}" executed`,
        status: execution.status.toLowerCase(),
        timestamp: execution.startedAt.toISOString()
      }))
    };

    return res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
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