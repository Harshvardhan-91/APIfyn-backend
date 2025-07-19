import express, { Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { prisma } from '../index';
import bcrypt from 'bcryptjs';
import { createLogger } from '../utils/logger';

const router = express.Router();
const logger = createLogger();

// Get user dashboard data
router.get('/dashboard', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  // Get dashboard statistics
  const [
    totalWorkflows,
    activeWorkflows,
    totalExecutions,
    recentExecutions,
    connectedIntegrations,
  ] = await Promise.all([
    prisma.workflow.count({ where: { userId: user.id } }),
    prisma.workflow.count({ where: { userId: user.id, isActive: true } }),
    prisma.workflowExecution.count({ where: { userId: user.id } }),
    prisma.workflowExecution.findMany({
      where: { userId: user.id },
      include: { workflow: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
    prisma.integration.count({ where: { userId: user.id, isActive: true } }),
  ]);

  // Calculate executions today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const executionsToday = await prisma.workflowExecution.count({
    where: {
      userId: user.id,
      startedAt: { gte: today },
    },
  });

  // Calculate this week's executions
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const executionsThisWeek = await prisma.workflowExecution.count({
    where: {
      userId: user.id,
      startedAt: { gte: weekStart },
    },
  });

  // Format recent activity
  const recentActivity = recentExecutions.map(execution => ({
    id: execution.id,
    name: execution.workflow.name,
    type: 'workflow_execution',
    status: execution.status.toLowerCase(),
    timestamp: execution.startedAt.toISOString(),
    duration: execution.duration ? `${execution.duration.toFixed(1)}s` : null,
  }));

  res.json({
    success: true,
    data: {
      totalWorkflows,
      activeWorkflows,
      executionsToday,
      thisWeek: executionsThisWeek,
      connectedApps: connectedIntegrations,
      recentActivity,
      stats: {
        totalExecutions,
        successRate: recentExecutions.length > 0 
          ? (recentExecutions.filter(e => e.status === 'SUCCESS').length / recentExecutions.length) * 100 
          : 0,
      },
    },
  });
}));

// Get user profile
router.get('/profile', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  
  const { firebaseUid, ...userProfile } = user;
  
  res.json({
    success: true,
    user: userProfile,
  });
}));

// Update user profile
router.put('/profile', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { firstName, lastName, company, jobTitle, displayName } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      company: company || user.company,
      jobTitle: jobTitle || user.jobTitle,
      displayName: displayName || user.displayName,
      updatedAt: new Date(),
    },
  });

  const { firebaseUid, ...userProfile } = updatedUser;

  logger.info(`User profile updated: ${user.email}`);

  res.json({
    success: true,
    user: userProfile,
  });
}));

// Get user usage statistics
router.get('/usage', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  // Get usage statistics for the current month
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);

  const [
    monthlyExecutions,
    monthlyApiCalls,
    subscriptionLimits,
  ] = await Promise.all([
    prisma.workflowExecution.count({
      where: {
        userId: user.id,
        startedAt: { gte: currentMonth },
      },
    }),
    // API calls would be tracked separately, for now using workflow executions
    prisma.workflowExecution.count({
      where: {
        userId: user.id,
        startedAt: { gte: currentMonth },
      },
    }),
    // Define subscription limits based on tier
    Promise.resolve(getSubscriptionLimits(user.subscription)),
  ]);

  res.json({
    success: true,
    usage: {
      executions: {
        used: monthlyExecutions,
        limit: subscriptionLimits.executions,
        percentage: (monthlyExecutions / subscriptionLimits.executions) * 100,
      },
      apiCalls: {
        used: monthlyApiCalls,
        limit: subscriptionLimits.apiCalls,
        percentage: (monthlyApiCalls / subscriptionLimits.apiCalls) * 100,
      },
      workflows: {
        used: user.workflowsUsed || 0,
        limit: subscriptionLimits.workflows,
        percentage: ((user.workflowsUsed || 0) / subscriptionLimits.workflows) * 100,
      },
    },
    subscription: {
      tier: user.subscription,
      status: user.subscriptionStatus || 'active',
      trialEndsAt: user.trialEndsAt,
    },
  });
}));

// Generate API key
router.post('/api-keys', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { name, permissions = [], expiresAt } = req.body;

  if (!name) {
    throw new CustomError('API key name is required', 400);
  }

  // Generate random API key
  const apiKey = generateApiKey();
  const keyHash = await bcrypt.hash(apiKey, 12);
  const keyPreview = apiKey.substring(0, 8) + '...';

  const newApiKey = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      keyPreview,
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      userId: user.id,
    },
  });

  logger.info(`API key created: ${name} for user ${user.email}`);

  res.json({
    success: true,
    apiKey: {
      id: newApiKey.id,
      name: newApiKey.name,
      key: apiKey, // Only returned once during creation
      keyPreview: newApiKey.keyPreview,
      permissions: newApiKey.permissions,
      expiresAt: newApiKey.expiresAt,
      createdAt: newApiKey.createdAt,
    },
  });
}));

// Get user API keys
router.get('/api-keys', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      keyPreview: true,
      permissions: true,
      lastUsedAt: true,
      totalRequests: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    apiKeys,
  });
}));

// Delete API key
router.delete('/api-keys/:id', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;

  const apiKey = await prisma.apiKey.findFirst({
    where: { id, userId: user.id },
  });

  if (!apiKey) {
    throw new CustomError('API key not found', 404);
  }

  await prisma.apiKey.delete({
    where: { id },
  });

  logger.info(`API key deleted: ${apiKey.name} for user ${user.email}`);

  res.json({
    success: true,
    message: 'API key deleted successfully',
  });
}));

// Admin routes
router.get('/admin/users', 
  authenticateFirebaseToken, 
  requireRole(['ADMIN', 'SUPER_ADMIN']), 
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page = 1, limit = 50, search } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const where = search ? {
      OR: [
        { email: { contains: String(search), mode: 'insensitive' as const } },
        { displayName: { contains: String(search), mode: 'insensitive' as const } },
      ],
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          subscription: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              workflows: true,
              executions: true,
            },
          },
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  })
);

// Helper functions
function getSubscriptionLimits(tier: string) {
  const limits = {
    FREE: { executions: 100, apiCalls: 1000, workflows: 3 },
    STARTER: { executions: 1000, apiCalls: 10000, workflows: 10 },
    PROFESSIONAL: { executions: 10000, apiCalls: 100000, workflows: 50 },
    ENTERPRISE: { executions: 100000, apiCalls: 1000000, workflows: 200 },
  };
  
  return limits[tier as keyof typeof limits] || limits.FREE;
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'fapi_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default router;
