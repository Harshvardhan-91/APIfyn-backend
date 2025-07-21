import express, { Request, Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { prisma } from '../index';
import { createLogger } from '../utils/logger';

const router = express.Router();
const logger = createLogger();

// Get all workflows for user
router.get('/', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { page = 1, limit = 20, search, category, isActive } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  
  const where: any = { userId: user.id };
  
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: 'insensitive' } },
      { description: { contains: String(search), mode: 'insensitive' } },
    ];
  }
  
  if (category) {
    where.category = String(category);
  }
  
  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const [workflows, total] = await Promise.all([
    prisma.workflow.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        tags: true,
        isActive: true,
        isPublic: true,
        triggerType: true,
        totalRuns: true,
        successfulRuns: true,
        failedRuns: true,
        lastExecutedAt: true,
        avgExecutionTime: true,
        createdAt: true,
        updatedAt: true,
      },
      skip,
      take: Number(limit),
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.workflow.count({ where }),
  ]);

  res.json({
    success: true,
    workflows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
}));

// Get workflow by ID
router.get('/:id', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;

  if (!id) {
    throw new CustomError('Workflow ID is required', 400);
  }

  const workflow = await prisma.workflow.findFirst({
    where: { id, userId: user.id },
    include: {
      executions: {
        take: 10,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          duration: true,
          errorMessage: true,
        },
      },
    },
  });

  if (!workflow) {
    throw new CustomError('Workflow not found', 404);
  }

  res.json({
    success: true,
    workflow,
  });
}));

// Create new workflow
router.post('/', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const {
    name,
    description,
    definition,
    category,
    tags = [],
    triggerType,
    triggerConfig,
    timeout = 300,
    retryAttempts = 3,
  } = req.body;

  if (!name || !definition || !triggerType) {
    throw new CustomError('Name, definition, and trigger type are required', 400);
  }

  // Validate trigger type
  const validTriggerTypes = [
    'MANUAL', 'WEBHOOK', 'SCHEDULE', 'EMAIL', 'API_CALL', 'FILE_UPLOAD', 'DATABASE_CHANGE'
  ];
  
  if (!validTriggerTypes.includes(triggerType)) {
    throw new CustomError('Invalid trigger type', 400);
  }

  // Check user workflow limits based on subscription
  const workflowCount = await prisma.workflow.count({
    where: { userId: user.id },
  });

  const limits = getSubscriptionLimits(user.subscription?.plan.type || 'FREE');
  if (workflowCount >= limits.workflows) {
    throw new CustomError('Workflow limit reached for your subscription', 403);
  }

  const workflow = await prisma.workflow.create({
    data: {
      name,
      description,
      definition,
      category,
      tags,
      triggerType,
      triggerConfig,
      timeout,
      retryAttempts,
      userId: user.id,
    },
  });

  // Update user workflow count
  await prisma.user.update({
    where: { id: user.id },
    data: { workflowsUsed: { increment: 1 } },
  });

  logger.info(`Workflow created: ${name} for user ${user.email}`);

  res.json({
    success: true,
    workflow: {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      category: workflow.category,
      tags: workflow.tags,
      triggerType: workflow.triggerType,
      isActive: workflow.isActive,
      createdAt: workflow.createdAt,
    },
  });
}));

// Update workflow
router.put('/:id', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const updateData = req.body;

  const workflow = await prisma.workflow.findFirst({
    where: { id, userId: user.id },
  });

  if (!workflow) {
    throw new CustomError('Workflow not found', 404);
  }

  const updatedWorkflow = await prisma.workflow.update({
    where: { id },
    data: {
      ...updateData,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  logger.info(`Workflow updated: ${workflow.name} for user ${user.email}`);

  res.json({
    success: true,
    workflow: updatedWorkflow,
  });
}));

// Delete workflow
router.delete('/:id', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;

  const workflow = await prisma.workflow.findFirst({
    where: { id, userId: user.id },
  });

  if (!workflow) {
    throw new CustomError('Workflow not found', 404);
  }

  await prisma.workflow.delete({
    where: { id },
  });

  // Update user workflow count
  await prisma.user.update({
    where: { id: user.id },
    data: { workflowsUsed: { decrement: 1 } },
  });

  logger.info(`Workflow deleted: ${workflow.name} for user ${user.email}`);

  res.json({
    success: true,
    message: 'Workflow deleted successfully',
  });
}));

// Execute workflow manually
router.post('/:id/execute', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const { inputData = {}, executionMode = 'NORMAL' } = req.body;

  const workflow = await prisma.workflow.findFirst({
    where: { id, userId: user.id },
  });

  if (!workflow) {
    throw new CustomError('Workflow not found', 404);
  }

  if (!workflow.isActive) {
    throw new CustomError('Workflow is not active', 400);
  }

  // Create execution record
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId: workflow.id,
      userId: user.id,
      status: 'PENDING',
      inputData,
      executionMode,
      triggerSource: 'manual',
    },
  });

  // TODO: Implement actual workflow execution engine
  // For now, simulate execution
  setTimeout(async () => {
    try {
      const result = await executeWorkflow(workflow, inputData);
      
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          duration: 2.5, // Mock duration
          outputData: result,
        },
      });

      // Update workflow stats
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          totalRuns: { increment: 1 },
          successfulRuns: { increment: 1 },
          lastExecutedAt: new Date(),
        },
      });
    } catch (error) {
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          duration: 1.0,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      await prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          totalRuns: { increment: 1 },
          failedRuns: { increment: 1 },
        },
      });
    }
  }, 1000);

  res.json({
    success: true,
    execution: {
      id: execution.id,
      status: execution.status,
      startedAt: execution.startedAt,
    },
    message: 'Workflow execution started',
  });
}));

// Get workflow execution history
router.get('/:id/executions', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const { page = 1, limit = 20, status } = req.query;

  const workflow = await prisma.workflow.findFirst({
    where: { id, userId: user.id },
  });

  if (!workflow) {
    throw new CustomError('Workflow not found', 404);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const where: any = { workflowId: id };
  
  if (status) {
    where.status = String(status).toUpperCase();
  }

  const [executions, total] = await Promise.all([
    prisma.workflowExecution.findMany({
      where,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        duration: true,
        errorMessage: true,
        triggerSource: true,
        executionMode: true,
      },
      skip,
      take: Number(limit),
      orderBy: { startedAt: 'desc' },
    }),
    prisma.workflowExecution.count({ where }),
  ]);

  res.json({
    success: true,
    executions,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
}));

// Get workflow templates (public workflows)
router.get('/templates/public', asyncHandler(async (req: Request, res: Response) => {
  const { category, search } = req.query;
  
  const where: any = { isPublic: true };
  
  if (category) {
    where.category = String(category);
  }
  
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: 'insensitive' } },
      { description: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  const templates = await prisma.workflow.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      tags: true,
      triggerType: true,
      totalRuns: true,
      avgExecutionTime: true,
      createdAt: true,
      user: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
    orderBy: { totalRuns: 'desc' },
    take: 50,
  });

  res.json({
    success: true,
    templates,
  });
}));

// Helper functions
function getSubscriptionLimits(tier: string) {
  const limits = {
    FREE: { workflows: 3 },
    STARTER: { workflows: 10 },
    PROFESSIONAL: { workflows: 50 },
    ENTERPRISE: { workflows: 200 },
  };
  
  return limits[tier as keyof typeof limits] || limits.FREE;
}

async function executeWorkflow(workflow: any, inputData: any) {
  // Mock workflow execution
  // TODO: Implement actual workflow execution engine
  return {
    message: 'Workflow executed successfully',
    steps: workflow.definition?.steps || [],
    inputData,
    timestamp: new Date().toISOString(),
  };
}

export default router;
