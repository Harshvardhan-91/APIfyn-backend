import express, { Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { prisma } from '../db';

const router = express.Router();
const logger = createLogger();

// Create a new workflow
router.post('/', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { name, description, definition, category, triggerType, isActive } = req.body;

  try {
    // Validate required fields
    if (!name || !definition) {
      return res.status(400).json({
        success: false,
        error: 'Name and definition are required'
      });
    }

    // Create the workflow
    const workflow = await prisma.workflow.create({
      data: {
        name,
        description: description || '',
        definition: definition as any, // Prisma handles JSON automatically
        category: category || 'general',
        triggerType: triggerType || 'MANUAL',
        isActive: isActive || false,
        userId: user.id
      }
    });

    logger.info(`Workflow created successfully: ${workflow.id} for user ${user.id}`);

    res.json({
      success: true,
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        definition: workflow.definition,
        category: workflow.category,
        triggerType: workflow.triggerType,
        isActive: workflow.isActive,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt
      },
      message: 'Workflow saved successfully'
    });
  } catch (error) {
    logger.error('Error creating workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save workflow'
    });
  }
}));

// Get all workflows for user
router.get('/', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  try {
    const workflows = await prisma.workflow.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.json({
      success: true,
      workflows: workflows.map(workflow => ({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        definition: workflow.definition,
        category: workflow.category,
        triggerType: workflow.triggerType,
        isActive: workflow.isActive,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt
      }))
    });
  } catch (error) {
    logger.error('Error fetching workflows:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflows'
    });
  }
}));

export default router;