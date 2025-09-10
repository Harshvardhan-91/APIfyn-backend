import express, { Request, Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { prisma } from '../db';
import { WebhookService } from '../services/webhook.service';
import { OAuthService } from '../services/oauth.service';

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
        isActive: isActive !== undefined ? isActive : true, // Default to true if not specified
        userId: user.id
      }
    });

    logger.info(`Workflow created successfully: ${workflow.id} for user ${user.id}`);

    // Auto-setup webhooks for GitHub trigger workflows
    if (workflow.isActive) {
      try {
        await setupWorkflowWebhooks(workflow, user.id);
      } catch (webhookError) {
        logger.warn('Failed to setup webhooks for workflow:', webhookError);
        // Don't fail the workflow creation if webhook setup fails
      }
    }

    return res.json({
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
    return res.status(500).json({
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

    return res.json({
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
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch workflows'
    });
  }
}));

// Get individual workflow by ID
router.get('/:id', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;

  try {
    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        userId: user.id
      }
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    return res.json({
      success: true,
      workflow
    });
  } catch (error) {
    logger.error('Error fetching workflow:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch workflow'
    });
  }
}));

// Update workflow status (activate/deactivate)
router.patch('/:id', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const workflow = await prisma.workflow.updateMany({
      where: {
        id,
        userId: user.id
      },
      data: {
        isActive
      }
    });

    if (workflow.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    return res.json({
      success: true,
      message: `Workflow ${isActive ? 'activated' : 'paused'} successfully`
    });
  } catch (error) {
    logger.error('Error updating workflow status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update workflow status'
    });
  }
}));

// Update workflow status (activate/deactivate) - alternative route
router.patch('/:id/status', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const workflow = await prisma.workflow.updateMany({
      where: {
        id,
        userId: user.id
      },
      data: {
        isActive
      }
    });

    if (workflow.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    return res.json({
      success: true,
      message: `Workflow ${isActive ? 'activated' : 'paused'} successfully`
    });
  } catch (error) {
    logger.error('Error updating workflow status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update workflow status'
    });
  }
}));

// Delete workflow
router.delete('/:id', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;

  try {
    const workflow = await prisma.workflow.deleteMany({
      where: {
        id,
        userId: user.id
      }
    });

    if (workflow.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    return res.json({
      success: true,
      message: 'Workflow deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting workflow:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete workflow'
    });
  }
}));

// Helper function to setup webhooks for a workflow
async function setupWorkflowWebhooks(workflow: any, userId: string) {
  const definition = workflow.definition;
  
  // Check if workflow has GitHub trigger
  const hasGitHubTrigger = definition.blocks?.some((block: any) => 
    block.type === 'github-trigger'
  );

  if (hasGitHubTrigger) {
    // Get GitHub integration
    const githubIntegration = await prisma.integration.findFirst({
      where: {
        userId: userId,
        type: 'GITHUB'
      }
    });

    if (githubIntegration?.accessToken) {
      // Find the GitHub trigger block to get repository config
      const githubBlock = definition.blocks.find((block: any) => 
        block.type === 'github-trigger'
      );

      if (githubBlock?.config?.repository) {
        try {
          await WebhookService.createGitHubWebhook(
            githubIntegration.accessToken,
            githubBlock.config.repository,
            workflow.id
          );
          logger.info(`GitHub webhook created for workflow ${workflow.id}`);
        } catch (error) {
          logger.error(`Failed to create GitHub webhook for workflow ${workflow.id}:`, error);
          throw error;
        }
      }
    }
  }
}

export default router;
