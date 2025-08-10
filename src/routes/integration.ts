import express, { Request, Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { prisma } from '../index';
import { createLogger } from '../utils/logger';
import { IntegrationType } from '@prisma/client';
import fetch from 'node-fetch';

const router = express.Router();
const logger = createLogger();

// Helper function to convert provider string to IntegrationType
function getIntegrationType(provider: string): IntegrationType {
  const providerUpper = provider.toUpperCase();
  if (Object.values(IntegrationType).includes(providerUpper as IntegrationType)) {
    return providerUpper as IntegrationType;
  }
  throw new CustomError(`Unsupported integration type: ${provider}`, 400);
}

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

  if (!id) {
    throw new CustomError('Integration ID is required', 400);
  }

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

  if (!id) {
    throw new CustomError('Integration ID is required', 400);
  }

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

  if (!id) {
    throw new CustomError('Integration ID is required', 400);
  }

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
router.get('/types', asyncHandler(async (req: Request, res: Response) => {
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

// Get integration status for specific types
router.get('/status', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  
  const integrations = await prisma.integration.findMany({
    where: { 
      userId: user.id,
      isActive: true 
    },
    select: {
      type: true,
      isActive: true,
      createdAt: true,
    },
  });
  
  // Create status map
  const statusMap: Record<string, string> = {};
  integrations.forEach(integration => {
    statusMap[integration.type.toLowerCase()] = 'connected';
  });
  
  res.json({
    success: true,
    integrations: statusMap,
  });
}));

// OAuth Authorization Routes
router.get('/oauth/:provider/authorize', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { provider } = req.params;
  const user = req.user;
  
  if (!provider) {
    throw new CustomError('Provider parameter is required', 400);
  }
  
  let authUrl = '';
  let redirectUri = '';
  
  switch (provider.toLowerCase()) {
    case 'gmail':
      redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/gmail/callback';
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${process.env.GMAIL_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send')}&` +
        `access_type=offline&` +
        `state=${user.id}`;
      break;
      
    case 'slack':
      redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/slack/callback';
      authUrl = `https://slack.com/oauth/v2/authorize?` +
        `client_id=${process.env.SLACK_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent('channels:read,chat:write,users:read')}&` +
        `state=${user.id}`;
      break;
      
    case 'notion':
      redirectUri = process.env.NOTION_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/notion/callback';
      authUrl = `https://api.notion.com/v1/oauth/authorize?` +
        `client_id=${process.env.NOTION_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `owner=user&` +
        `state=${user.id}`;
      break;
      
    case 'discord':
      redirectUri = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/discord/callback';
      authUrl = `https://discord.com/api/oauth2/authorize?` +
        `client_id=${process.env.DISCORD_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('bot webhook.incoming')}&` +
        `state=${user.id}`;
      break;
      
    default:
      throw new CustomError('Unsupported OAuth provider', 400);
  }
  
  res.json({
    success: true,
    authUrl: authUrl,
    provider: provider,
    message: 'Redirect user to this URL for authorization'
  });
}));

// OAuth Callback Routes
router.get('/oauth/:provider/callback', asyncHandler(async (req: Request, res: Response) => {
  const { provider } = req.params;
  const { code, state } = req.query;
  
  if (!provider) {
    throw new CustomError('Provider parameter is required', 400);
  }
  
  if (!code || !state) {
    throw new CustomError('Missing authorization code or state', 400);
  }
  
  try {
    let tokenResponse: any = {};
    let redirectUri = '';
    
    switch (provider.toLowerCase()) {
      case 'gmail':
        redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/gmail/callback';
        tokenResponse = await exchangeCodeForToken('gmail', code as string, redirectUri);
        break;
        
      case 'slack':
        redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/slack/callback';
        tokenResponse = await exchangeCodeForToken('slack', code as string, redirectUri);
        break;
        
      case 'notion':
        redirectUri = process.env.NOTION_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/notion/callback';
        tokenResponse = await exchangeCodeForToken('notion', code as string, redirectUri);
        break;
        
      case 'discord':
        redirectUri = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/discord/callback';
        tokenResponse = await exchangeCodeForToken('discord', code as string, redirectUri);
        break;
        
      default:
        throw new CustomError('Unsupported OAuth provider', 400);
    }
    
    // Save integration to database
    await prisma.integration.create({
      data: {
        userId: state as string,
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Integration`,
        type: getIntegrationType(provider),
        config: {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : null,
        },
        isActive: true,
      },
    });
    
    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL}/workflows?integration=${provider}&status=success`);
    
  } catch (error) {
    logger.error(`OAuth callback error for ${provider}:`, error);
    res.redirect(`${process.env.FRONTEND_URL}/workflows?integration=${provider}&status=error`);
  }
}));

// Helper function to exchange code for token
async function exchangeCodeForToken(provider: string, code: string, redirectUri: string) {
  let tokenUrl = '';
  let requestBody: any = {};
  
  switch (provider) {
    case 'gmail':
      tokenUrl = 'https://oauth2.googleapis.com/token';
      requestBody = {
        client_id: process.env.GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      };
      break;
      
    case 'slack':
      tokenUrl = 'https://slack.com/api/oauth.v2.access';
      requestBody = {
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri,
      };
      break;
      
    case 'notion':
      tokenUrl = 'https://api.notion.com/v1/oauth/token';
      requestBody = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      };
      break;
      
    case 'discord':
      tokenUrl = 'https://discord.com/api/oauth2/token';
      requestBody = {
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      };
      break;
  }
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(provider === 'notion' ? {
        'Authorization': `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64')}`,
        'Notion-Version': '2022-06-28'
      } : {})
    },
    body: new URLSearchParams(requestBody).toString(),
  });
  
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }
  
  return await response.json();
}

export default router;
