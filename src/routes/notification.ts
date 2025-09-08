import express, { Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// Get notifications for user (placeholder for future implementation)
router.get('/', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  // For now, return empty array as we're building from scratch
  const notifications: any[] = [];

  res.json({
    success: true,
    notifications,
    message: 'Notifications will be built from scratch'
  });
}));

export default router;
