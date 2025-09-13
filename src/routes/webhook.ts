import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { WebhookService } from '../services/webhook.service';

const router = express.Router();
const logger = createLogger();

// GitHub webhook endpoint
router.post('/github/:workflowId', asyncHandler(async (req: Request, res: Response) => {
  const { workflowId } = req.params;
  const payload = req.body;

  if (!workflowId) {
    return res.status(400).json({ error: 'Workflow ID is required' });
  }

  // Verify GitHub webhook signature (optional but recommended)
  // const signature = req.headers['x-hub-signature-256'];
  // if (!verifyGitHubSignature(payload, signature)) {
  //   return res.status(401).json({ error: 'Invalid signature' });
  // }

  try {
    logger.info(`Received GitHub webhook for workflow ${workflowId}`);
    
    await WebhookService.processGitHubWebhook(workflowId, payload);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully' 
    });
  } catch (error) {
    logger.error(`Error processing GitHub webhook for workflow ${workflowId}:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to process webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

// Test webhook endpoint for development
router.post('/test/:workflowId', asyncHandler(async (req: Request, res: Response) => {
  const { workflowId } = req.params;
  
  if (!workflowId) {
    return res.status(400).json({ error: 'Workflow ID is required' });
  }
  
  // Mock GitHub webhook payload for testing
  const testPayload = {
    repository: {
      id: 123456,
      name: 'test-repo',
      full_name: 'user/test-repo',
      html_url: 'https://github.com/user/test-repo'
    },
    pusher: {
      name: 'Test User',
      email: 'test@example.com'
    },
    head_commit: {
      id: 'abc123def456',
      message: 'Add new feature: Enhanced user authentication',
      author: {
        name: 'Test User',
        email: 'test@example.com'
      },
      url: 'https://github.com/user/test-repo/commit/abc123def456',
      timestamp: new Date().toISOString()
    },
    commits: [
      {
        id: 'abc123def456',
        message: 'Add new feature: Enhanced user authentication',
        author: {
          name: 'Test User',
          email: 'test@example.com'
        },
        url: 'https://github.com/user/test-repo/commit/abc123def456'
      }
    ],
    ref: 'refs/heads/main',
    before: 'def456abc789',
    after: 'abc123def456',
    compare: 'https://github.com/user/test-repo/compare/def456abc789...abc123def456'
  };

  try {
    logger.info(`Processing test webhook for workflow ${workflowId}`);
    
    await WebhookService.processGitHubWebhook(workflowId, testPayload);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Test webhook processed successfully',
      payload: testPayload
    });
  } catch (error) {
    logger.error(`Error processing test webhook for workflow ${workflowId}:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to process test webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;
