import express, { Response, Request } from 'express';
import { RazorpayService } from '../services/razorpay.service';
import { authenticateFirebaseToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';

const logger = createLogger();

const router = express.Router();

// Create a new subscription
router.post('/create', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { planId, interval } = req.body;
  try {
    const subscription = await RazorpayService.createSubscription(req.user.firebaseUid, planId, interval);
    res.json({
      success: true,
      subscription,
      razorpayKey: process.env.RAZORPAY_KEY_ID
    });
  } catch (error: any) {
    logger.error('Error creating subscription:', error);
    res.status(400).json({
      success: false,
      error: {
        message: error.message || 'Failed to create subscription',
        code: 'SUBSCRIPTION_CREATE_ERROR'
      }
    });
  }
}));

// Handle successful payment
router.post('/payment/success', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  const result = await RazorpayService.handlePaymentSuccess(
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature
  );
  res.json(result);
}));

// Cancel subscription
router.post('/cancel', authenticateFirebaseToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { subscriptionId } = req.body;
  const result = await RazorpayService.cancelSubscription(req.user.id, subscriptionId);
  res.json(result);
}));

// Webhook handler
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const webhook = req.body;
  await RazorpayService.handleWebhook(webhook.event, webhook);
  res.json({ received: true });
}));

export default router;
