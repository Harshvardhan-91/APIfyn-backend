import express from 'express';
import { ExecutionService } from '../services/execution.service';
import { authenticateFirebaseToken } from '../middleware/auth';

const router = express.Router();

// Log execution
router.post('/', authenticateFirebaseToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) throw new Error('User not authenticated');
    const execution = await ExecutionService.logExecution({
      ...req.body,
      userId: req.user.id as string,
    });
    res.json({ success: true, execution });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get executions for workflow
router.get('/workflow/:workflowId', authenticateFirebaseToken, async (req, res) => {
  try {
    if (!req.params.workflowId) throw new Error('Workflow ID required');
    const executions = await ExecutionService.getWorkflowExecutions(req.params.workflowId as string);
    res.json({ success: true, executions });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get execution by ID
router.get('/:id', authenticateFirebaseToken, async (req, res) => {
  try {
    if (!req.params.id) throw new Error('Execution ID required');
    const execution = await ExecutionService.getExecution(req.params.id as string);
    res.json({ success: true, execution });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Retry execution
router.post('/:id/retry', authenticateFirebaseToken, async (req, res) => {
  try {
    if (!req.params.id) throw new Error('Execution ID required');
    const execution = await ExecutionService.retryExecution(req.params.id as string);
    res.json({ success: true, execution });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
