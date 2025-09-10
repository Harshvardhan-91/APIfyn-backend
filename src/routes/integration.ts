import express, { Request, Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { prisma } from '../db';
import { Integration } from '@prisma/client';
import { OAuthService } from '../services/oauth.service';

const router = express.Router();
const logger = createLogger();

// Get integration status for user
router.get('/status', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  try {
    // Get user's integrations from database
    const userIntegrations = await prisma.integration.findMany({
      where: {
        userId: user.id
      }
    });

    const integrations = {
      github: {
        connected: userIntegrations.some((i: Integration) => i.type === 'GITHUB' && i.accessToken),
        user: userIntegrations.find((i: Integration) => i.type === 'GITHUB')?.config || null,
        loading: false
      },
      slack: {
        connected: userIntegrations.some((i: Integration) => i.type === 'SLACK' && i.accessToken),
        workspaces: userIntegrations.filter((i: Integration) => i.type === 'SLACK' && i.accessToken).map((i: Integration) => i.config) || [],
        loading: false
      }
    };

    res.json({
      success: true,
      integrations
    });
  } catch (error) {
    logger.error('Error fetching integration status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch integration status'
    });
  }
}));

// GitHub OAuth Routes
router.post('/github/auth', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authUrl = OAuthService.generateGitHubAuthUrl(req.user.firebaseUid);
    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    logger.error('GitHub auth error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to initiate GitHub authentication'
    });
  }
}));

router.get('/github/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.status(400).json({
      success: false,
      message: 'Missing code or state parameter'
    });
  }

  try {
    const [firebaseUid] = (state as string).split('_');
    
    // Find user by firebaseUid
    const user = await prisma.user.findUnique({
      where: { firebaseUid }
    });

    if (!user) {
      throw new Error('User not found');
    }
    
    // Exchange code for access token
    const tokenData = await OAuthService.exchangeGitHubCode(code as string);
    
    // Get user info from GitHub
    const userData = await OAuthService.getGitHubUser(tokenData.access_token);

    // Save integration
    await OAuthService.saveGitHubIntegration(user.id, tokenData, userData);

    // Close the popup window and refresh parent
    return res.send(`
      <script>
        window.opener.postMessage({ type: 'github_auth_success' }, '*');
        window.close();
      </script>
    `);
  } catch (error) {
    logger.error('GitHub OAuth callback error:', error);
    return res.send(`
      <script>
        window.opener.postMessage({ type: 'github_auth_error', error: '${error instanceof Error ? error.message : 'Unknown error'}' }, '*');
        window.close();
      </script>
    `);
  }
}));

router.get('/github/repositories', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  try {
    const integration = await prisma.integration.findFirst({
      where: {
        userId: user.id,
        type: 'GITHUB'
      }
    });

    if (!integration || !integration.accessToken) {
      return res.status(401).json({
        success: false,
        message: 'GitHub not connected'
      });
    }

    const repositories = await OAuthService.getGitHubRepositories(integration.accessToken);

    return res.json({
      success: true,
      repositories
    });
  } catch (error) {
    logger.error('Error fetching GitHub repositories:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch repositories'
    });
  }
}));

// Slack OAuth Routes
router.post('/slack/auth', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authUrl = OAuthService.generateSlackAuthUrl(req.user.firebaseUid);
    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    logger.error('Slack auth error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to initiate Slack authentication'
    });
  }
}));

router.get('/slack/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.status(400).json({
      success: false,
      message: 'Missing code or state parameter'
    });
  }

  try {
    const [firebaseUid] = (state as string).split('_');
    
    // Find user by firebaseUid
    const user = await prisma.user.findUnique({
      where: { firebaseUid }
    });

    if (!user) {
      throw new Error('User not found');
    }
    
    // Exchange code for access token
    const tokenData = await OAuthService.exchangeSlackCode(code as string);

    // Save integration
    await OAuthService.saveSlackIntegration(user.id, tokenData);

    // Close the popup window and refresh parent
    return res.send(`
      <script>
        window.opener.postMessage({ type: 'slack_auth_success' }, '*');
        window.close();
      </script>
    `);
  } catch (error) {
    logger.error('Slack OAuth callback error:', error);
    return res.send(`
      <script>
        window.opener.postMessage({ type: 'slack_auth_error', error: '${error instanceof Error ? error.message : 'Unknown error'}' }, '*');
        window.close();
      </script>
    `);
  }
}));

router.get('/slack/channels', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  try {
    const integration = await prisma.integration.findFirst({
      where: {
        userId: user.id,
        type: 'SLACK'
      }
    });

    if (!integration || !integration.accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Slack not connected'
      });
    }

    const channels = await OAuthService.getSlackChannels(integration.accessToken);

    return res.json({
      success: true,
      channels
    });
  } catch (error) {
    logger.error('Error fetching Slack channels:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch channels'
    });
  }
}));

export default router;