import express from 'express';
import { NotificationService } from '../services/notification.service';
import { authenticateFirebaseToken } from '../middleware/auth';

const router = express.Router();

// List notifications for user
router.get('/', authenticateFirebaseToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) throw new Error('User not authenticated');
    const notifications = await NotificationService.getUserNotifications(req.user.id as string);
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Mark notification as read
router.post('/:id/read', authenticateFirebaseToken, async (req, res) => {
  try {
    if (!req.params.id) throw new Error('Notification ID required');
    const notification = await NotificationService.markAsRead(req.params.id as string);
    res.json({ success: true, notification });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
