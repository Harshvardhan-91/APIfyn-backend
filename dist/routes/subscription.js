"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const razorpay_service_1 = require("../services/razorpay.service");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)();
const router = express_1.default.Router();
router.post('/create', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { planId, interval } = req.body;
    if (!['free', 'pro', 'premium'].includes(planId.toLowerCase())) {
        throw new Error('Invalid plan type');
    }
    if (!['monthly', 'yearly'].includes(interval)) {
        throw new Error('Invalid interval. Must be monthly or yearly');
    }
    try {
        const subscription = await razorpay_service_1.RazorpayService.createSubscription(req.user.firebaseUid, planId.toLowerCase(), interval);
        res.json({
            success: true,
            subscription,
            razorpayKey: process.env.RAZORPAY_KEY_ID
        });
    }
    catch (error) {
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
router.post('/payment/success', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const result = await razorpay_service_1.RazorpayService.handlePaymentSuccess(razorpay_payment_id, razorpay_order_id, razorpay_signature);
    res.json(result);
}));
router.post('/cancel', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { subscriptionId } = req.body;
    const result = await razorpay_service_1.RazorpayService.cancelSubscription(req.user.id, subscriptionId);
    res.json(result);
}));
router.post('/webhook', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const webhook = req.body;
    await razorpay_service_1.RazorpayService.handleWebhook(webhook.event, webhook);
    res.json({ received: true });
}));
exports.default = router;
//# sourceMappingURL=subscription.js.map