import express, { Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { ExecutionEngine } from '../services/execution.engine';
import { prisma } from '../index';

const router = express.Router();
const logger = createLogger();

// Generic webhook endpoint that can trigger any workflow
router.post('/trigger/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    
    if (!workflowId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Workflow ID is required' 
      });
    }

    const triggerData = req.body;

    logger.info('Webhook trigger received', { workflowId, data: triggerData });

    // Find the workflow
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { user: true }
    });

    if (!workflow) {
      return res.status(404).json({ 
        success: false, 
        error: 'Workflow not found' 
      });
    }

    if (!workflow.isActive) {
      return res.status(400).json({ 
        success: false, 
        error: 'Workflow is not active' 
      });
    }

    // Execute the workflow asynchronously
    ExecutionEngine.executeWorkflow(workflowId, triggerData, 'NORMAL')
      .then(result => {
        logger.info('Webhook-triggered workflow completed', { 
          workflowId, 
          executionId: result.executionId,
          success: result.success 
        });
      })
      .catch(error => {
        logger.error('Webhook-triggered workflow failed', { 
          workflowId, 
          error: error.message 
        });
      });

    // Respond immediately to webhook
    return res.json({
      success: true,
      message: 'Workflow triggered successfully',
      workflowId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Webhook trigger error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// User-specific webhook endpoint for easier identification
router.post('/user/:userId/workflow/:workflowId', async (req: Request, res: Response) => {
  try {
    const { userId, workflowId } = req.params;
    
    if (!userId || !workflowId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and Workflow ID are required' 
      });
    }

    const triggerData = req.body;

    logger.info('User webhook trigger received', { userId, workflowId, data: triggerData });

    // Find the workflow and verify ownership
    const workflow = await prisma.workflow.findFirst({
      where: { 
        id: workflowId,
        userId: userId
      },
      include: { user: true }
    });

    if (!workflow) {
      return res.status(404).json({ 
        success: false, 
        error: 'Workflow not found or unauthorized' 
      });
    }

    if (!workflow.isActive) {
      return res.status(400).json({ 
        success: false, 
        error: 'Workflow is not active' 
      });
    }

    // Execute the workflow asynchronously
    ExecutionEngine.executeWorkflow(workflowId, triggerData, 'NORMAL')
      .then(result => {
        logger.info('User webhook-triggered workflow completed', { 
          userId,
          workflowId, 
          executionId: result.executionId,
          success: result.success 
        });
      })
      .catch(error => {
        logger.error('User webhook-triggered workflow failed', { 
          userId,
          workflowId, 
          error: error.message 
        });
      });

    // Respond immediately to webhook
    return res.json({
      success: true,
      message: 'Workflow triggered successfully',
      workflowId,
      userId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('User webhook trigger error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generic webhook endpoint for external services (Typeform, Zapier, etc.)
router.post('/external/:service/:workflowId', async (req: Request, res: Response) => {
  try {
    const { service, workflowId } = req.params;
    
    if (!service || !workflowId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Service and Workflow ID are required' 
      });
    }

    let triggerData = req.body;

    logger.info('External webhook trigger received', { service, workflowId, data: triggerData });

    // Transform data based on the service
    switch (service.toLowerCase()) {
      case 'typeform':
        triggerData = transformTypeformData(triggerData);
        break;
      case 'zapier':
        triggerData = transformZapierData(triggerData);
        break;
      case 'stripe':
        triggerData = transformStripeData(triggerData);
        break;
      case 'calendly':
        triggerData = transformCalendlyData(triggerData);
        break;
      default:
        // Keep original data for unknown services
        break;
    }

    // Find the workflow
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { user: true }
    });

    if (!workflow) {
      return res.status(404).json({ 
        success: false, 
        error: 'Workflow not found' 
      });
    }

    if (!workflow.isActive) {
      return res.status(400).json({ 
        success: false, 
        error: 'Workflow is not active' 
      });
    }

    // Execute the workflow asynchronously
    ExecutionEngine.executeWorkflow(workflowId, triggerData, 'NORMAL')
      .then(result => {
        logger.info('External webhook-triggered workflow completed', { 
          service,
          workflowId, 
          executionId: result.executionId,
          success: result.success 
        });
      })
      .catch(error => {
        logger.error('External webhook-triggered workflow failed', { 
          service,
          workflowId, 
          error: error.message 
        });
      });

    // Respond immediately to webhook
    return res.json({
      success: true,
      message: 'Workflow triggered successfully',
      service,
      workflowId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('External webhook trigger error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test webhook endpoint
router.post('/test/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    
    if (!workflowId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Workflow ID is required' 
      });
    }

    const triggerData = req.body || { test: true, timestamp: new Date().toISOString() };

    logger.info('Test webhook trigger received', { workflowId, data: triggerData });

    // Execute the workflow in test mode
    const result = await ExecutionEngine.executeWorkflow(workflowId, triggerData, 'TEST');

    return res.json({
      success: true,
      message: 'Test workflow executed successfully',
      result,
      workflowId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Test webhook trigger error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper functions to transform webhook data from different services
function transformTypeformData(data: any) {
  if (data.form_response) {
    const { form_response } = data;
    const answers: any = {};
    
    if (form_response.answers) {
      form_response.answers.forEach((answer: any) => {
        const field = answer.field?.ref || answer.field?.id || 'unknown';
        answers[field] = answer.text || answer.choice?.label || answer.email || answer.phone_number || answer.number;
      });
    }

    return {
      source: 'typeform',
      form_id: data.form_response?.form_id,
      response_id: data.form_response?.token,
      submitted_at: data.form_response?.submitted_at,
      answers,
      raw_data: data
    };
  }
  
  return { source: 'typeform', raw_data: data };
}

function transformZapierData(data: any) {
  return {
    source: 'zapier',
    ...data
  };
}

function transformStripeData(data: any) {
  if (data.type && data.data) {
    return {
      source: 'stripe',
      event_type: data.type,
      event_id: data.id,
      object: data.data.object,
      raw_data: data
    };
  }
  
  return { source: 'stripe', raw_data: data };
}

function transformCalendlyData(data: any) {
  if (data.event) {
    return {
      source: 'calendly',
      event_type: data.event,
      payload: data.payload,
      time: data.time,
      raw_data: data
    };
  }
  
  return { source: 'calendly', raw_data: data };
}

export default router;
