import express, { Request, Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { prisma } from '../index';
import { createLogger } from '../utils/logger';
import { WorkflowService } from '../services/workflow.service';

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
  const workflowData = req.body;

  if (!workflowData.name) {
    throw new CustomError('Workflow name is required', 400);
  }

  const workflow = await WorkflowService.createWorkflow(user.id, workflowData);

  logger.info('Workflow created', { workflowId: workflow.id, userId: user.id });

  res.status(201).json({
    success: true,
    workflow,
  });
}));

// Execute workflow
router.post('/:id/execute', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const { triggerData = {}, executionMode = 'NORMAL' } = req.body;

  if (!id) {
    throw new CustomError('Workflow ID is required', 400);
  }

  const result = await WorkflowService.executeWorkflow(id, triggerData, executionMode);

  res.json({
    success: true,
    execution: result,
  });
}));

// Get workflow templates (public workflows)
router.get('/templates', asyncHandler(async (req: Request, res: Response) => {
  const { category, search } = req.query;

  const templates = await WorkflowService.getWorkflowTemplates(
    category as string,
    search as string
  );

  res.json({
    success: true,
    templates,
  });
}));

// Clone workflow template
router.post('/templates/:templateId/clone', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { templateId } = req.params;
  const { customName } = req.body;

  if (!templateId) {
    throw new CustomError('Template ID is required', 400);
  }

  const clonedWorkflow = await WorkflowService.cloneWorkflowTemplate(user.id, templateId, customName);

  res.status(201).json({
    success: true,
    workflow: clonedWorkflow,
  });
}));

// Update workflow
router.put('/:id', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const updateData = req.body;

  if (!id) {
    throw new CustomError('Workflow ID is required', 400);
  }

  const workflow = await WorkflowService.updateWorkflow(id, user.id, updateData);

  res.json({
    success: true,
    workflow,
  });
}));

// Delete workflow
router.delete('/:id', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;

  if (!id) {
    throw new CustomError('Workflow ID is required', 400);
  }

  await WorkflowService.deleteWorkflow(id, user.id);

  res.json({
    success: true,
    message: 'Workflow deleted successfully',
  });
}));

// Helper functions for subscription limits
function getSubscriptionLimits(tier: string) {
  const limits = {
    FREE: { workflows: 3, executions: 100 },
    STARTER: { workflows: 10, executions: 1000 },
    PROFESSIONAL: { workflows: 50, executions: 10000 },
    ENTERPRISE: { workflows: 200, executions: 100000 },
  };
  
  return limits[tier as keyof typeof limits] || limits.FREE;
}

export default router;
