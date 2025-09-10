import express, { Response } from 'express';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';

const router = express.Router();
const logger = createLogger();

// Get user subscription (placeholder for future implementation)
router.get('/', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  // For now, return basic subscription info as we're building from scratch
  const subscription = {
    plan: 'FREE',
    status: 'active',
    message: 'Subscription management will be built from scratch'
  };

  res.json({
    success: true,
    subscription
  });
}));

export default router;
