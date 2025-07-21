import express from 'express';
import { DashboardService } from '../services/dashboard.service';
import { authenticateFirebaseToken } from '../middleware/auth';

const router = express.Router();

// Get user stats
router.get('/stats', authenticateFirebaseToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) throw new Error('User not authenticated');
    const stats = await DashboardService.getUserStats(req.user.id as string);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Get recent executions
router.get('/executions', authenticateFirebaseToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) throw new Error('User not authenticated');
    const executions = await DashboardService.getRecentExecutions(req.user.id as string);
    res.json({ success: true, executions });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
