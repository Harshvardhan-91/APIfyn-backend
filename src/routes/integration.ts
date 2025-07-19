import express, { Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { prisma } from '../index';
import { createLogger } from '../utils/logger';

const router = express.Router();
const logger = createLogger();

// Get all integrations for user
router.get('/', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  const integrations = await prisma.integration.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      type: true,
      isActive: true,
      totalCalls: true,
      lastUsedAt: true,
      createdAt: true,
      // Don't expose sensitive config data
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    integrations,
  });
}));

// Create new integration
router.post('/', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { name, type, config } = req.body;

  if (!name || !type || !config) {
    throw new CustomError('Name, type, and config are required', 400);
  }

  // Validate integration type
  const validTypes = [
    'GMAIL', 'SLACK', 'NOTION', 'GOOGLE_SHEETS', 'AIRTABLE', 
    'SALESFORCE', 'HUBSPOT', 'WEBHOOK', 'REST_API', 'GRAPHQL'
  ];
  
  if (!validTypes.includes(type)) {
    throw new CustomError('Invalid integration type', 400);
  }

  const integration = await prisma.integration.create({
    data: {
      name,
      type,
      config,
      userId: user.id,
    },
  });

  logger.info(`Integration created: ${name} (${type}) for user ${user.email}`);

  res.json({
    success: true,
    integration: {
      id: integration.id,
      name: integration.name,
      type: integration.type,
      isActive: integration.isActive,
      createdAt: integration.createdAt,
    },
  });
}));

// Update integration
router.put('/:id', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const { name, config, isActive } = req.body;

  const integration = await prisma.integration.findFirst({
    where: { id, userId: user.id },
  });

  if (!integration) {
    throw new CustomError('Integration not found', 404);
  }

  const updatedIntegration = await prisma.integration.update({
    where: { id },
    data: {
      name: name || integration.name,
      config: config || integration.config,
      isActive: isActive !== undefined ? isActive : integration.isActive,
      updatedAt: new Date(),
    },
  });

  logger.info(`Integration updated: ${integration.name} for user ${user.email}`);

  res.json({
    success: true,
    integration: {
      id: updatedIntegration.id,
      name: updatedIntegration.name,
      type: updatedIntegration.type,
      isActive: updatedIntegration.isActive,
      updatedAt: updatedIntegration.updatedAt,
    },
  });
}));

// Delete integration
router.delete('/:id', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;

  const integration = await prisma.integration.findFirst({
    where: { id, userId: user.id },
  });

  if (!integration) {
    throw new CustomError('Integration not found', 404);
  }

  await prisma.integration.delete({
    where: { id },
  });

  logger.info(`Integration deleted: ${integration.name} for user ${user.email}`);

  res.json({
    success: true,
    message: 'Integration deleted successfully',
  });
}));

// Test integration connection
router.post('/:id/test', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;

  const integration = await prisma.integration.findFirst({
    where: { id, userId: user.id },
  });

  if (!integration) {
    throw new CustomError('Integration not found', 404);
  }

  // TODO: Implement actual connection testing based on integration type
  // For now, simulate a test
  const testResult = await testIntegrationConnection(integration);

  if (testResult.success) {
    await prisma.integration.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  res.json({
    success: true,
    test: testResult,
  });
}));

// Get available integration types
router.get('/types', asyncHandler(async (req, res: Response) => {
  const integrationTypes = [
    {
      type: 'GMAIL',
      name: 'Gmail',
      description: 'Send and manage emails',
      category: 'Email',
      authType: 'oauth',
    },
    {
      type: 'SLACK',
      name: 'Slack',
      description: 'Send messages and manage channels',
      category: 'Communication',
      authType: 'oauth',
    },
    {
      type: 'NOTION',
      name: 'Notion',
      description: 'Create and manage pages and databases',
      category: 'Productivity',
      authType: 'oauth',
    },
    {
      type: 'GOOGLE_SHEETS',
      name: 'Google Sheets',
      description: 'Read and write spreadsheet data',
      category: 'Data',
      authType: 'oauth',
    },
    {
      type: 'WEBHOOK',
      name: 'Webhook',
      description: 'Receive HTTP requests',
      category: 'Triggers',
      authType: 'none',
    },
    {
      type: 'REST_API',
      name: 'REST API',
      description: 'Make HTTP requests to any API',
      category: 'API',
      authType: 'api_key',
    },
  ];

  res.json({
    success: true,
    types: integrationTypes,
  });
}));

// Helper function to test integration connections
async function testIntegrationConnection(integration: any) {
  try {
    // This would implement actual testing logic based on integration type
    switch (integration.type) {
      case 'GMAIL':
        // Test Gmail API connection
        return { success: true, message: 'Gmail connection successful' };
      
      case 'SLACK':
        // Test Slack API connection
        return { success: true, message: 'Slack connection successful' };
      
      case 'WEBHOOK':
        // Webhook doesn't need testing
        return { success: true, message: 'Webhook endpoint ready' };
      
      default:
        return { success: false, message: 'Integration test not implemented' };
    }
  } catch (error) {
    logger.error('Integration test failed:', error);
    return { success: false, message: 'Connection test failed' };
  }
}

export default router;
