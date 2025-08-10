"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RazorpayService = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)();
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});
class RazorpayService {
    static async createSubscription(userId, planId, interval) {
        try {
            logger.info('Creating subscription', { userId, planId, interval });
            const [user, plan] = await Promise.all([
                index_1.prisma.user.findUnique({
                    where: { firebaseUid: userId },
                    include: { subscription: true }
                }),
                index_1.prisma.plan.findFirst({
                    where: {
                        type: planId.toUpperCase()
                    }
                })
            ]);
            if (!user) {
                logger.error('User not found', { firebaseUid: userId });
                throw new Error('User not found');
            }
            if (!plan) {
                logger.error('Plan not found', { planId });
                throw new Error('Plan not found');
            }
            if (user.subscription && user.subscription.status === 'active') {
                logger.warn('User already has an active subscription', {
                    userId: user.id,
                    subscriptionId: user.subscription.id
                });
                throw new Error('User already has an active subscription');
            }
            const totalAmount = interval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const intervalCount = interval === 'monthly' ? 1 : 12;
            const razorpayPlan = await razorpay.plans.create({
                period: interval === 'monthly' ? 'monthly' : 'yearly',
                interval: 1,
                item: {
                    name: plan.name,
                    amount: totalAmount * 100,
                    currency: 'INR',
                    description: plan.description
                },
                notes: {
                    planType: plan.type,
                    planId: plan.id
                }
            });
            const subscription = await razorpay.subscriptions.create({
                plan_id: razorpayPlan.id,
                customer_notify: 1,
                total_count: 12,
                notes: {
                    userId: user.id,
                    planId: plan.id,
                    firebaseUid: user.firebaseUid
                }
            });
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const nextPeriod = currentTimestamp + (interval === 'monthly' ? 30 * 24 * 60 * 60 : 365 * 24 * 60 * 60);
            const dbSubscription = await index_1.prisma.subscription.create({
                data: {
                    razorpaySubId: subscription.id,
                    status: subscription.status,
                    currentPeriodStart: new Date(currentTimestamp * 1000),
                    currentPeriodEnd: new Date(nextPeriod * 1000),
                    interval,
                    intervalCount,
                    planId: plan.id,
                    userId: user.id
                }
            });
            return {
                subscription: dbSubscription,
                razorpayKey: process.env.RAZORPAY_KEY_ID
            };
        }
        catch (error) {
            logger.error('Error creating subscription:', error);
            throw error;
        }
    }
    static async handlePaymentSuccess(paymentId, orderId, signature) {
        try {
            const body = JSON.stringify({
                payment_id: paymentId,
                order_id: orderId
            });
            const isValid = razorpay_1.default.validateWebhookSignature(body, signature, process.env.RAZORPAY_WEBHOOK_SECRET);
            if (!isValid) {
                throw new Error('Invalid payment signature');
            }
            const payment = await razorpay.payments.fetch(paymentId);
            const subscription = await index_1.prisma.subscription.findFirst({
                where: { razorpaySubId: payment.order_id }
            });
            if (!subscription) {
                throw new Error('Subscription not found');
            }
            await index_1.prisma.payment.create({
                data: {
                    razorpayPaymentId: paymentId,
                    razorpayOrderId: orderId,
                    razorpaySignature: signature,
                    amount: Number(payment.amount) / 100,
                    currency: payment.currency,
                    status: payment.status,
                    orderType: 'subscription_charge',
                    subscriptionId: subscription.id,
                    userId: subscription.userId,
                    metadata: {
                        razorpayPayment: {
                            id: payment.id,
                            entity: payment.entity,
                            amount: payment.amount,
                            currency: payment.currency,
                            status: payment.status,
                            order_id: payment.order_id
                        }
                    }
                }
            });
            if (payment.status === 'captured') {
                await index_1.prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { status: 'active' }
                });
            }
            return { success: true };
        }
        catch (error) {
            logger.error('Error handling payment success:', error);
            throw error;
        }
    }
    static async cancelSubscription(userId, subscriptionId) {
        try {
            const subscription = await index_1.prisma.subscription.findFirst({
                where: {
                    id: subscriptionId,
                    userId: userId
                }
            });
            if (!subscription) {
                throw new Error('Subscription not found');
            }
            if (subscription.razorpaySubId) {
                await razorpay.subscriptions.cancel(subscription.razorpaySubId);
            }
            await index_1.prisma.subscription.update({
                where: { id: subscriptionId },
                data: {
                    status: 'cancelled',
                    cancelAtPeriodEnd: true
                }
            });
            return { success: true };
        }
        catch (error) {
            logger.error('Error cancelling subscription:', error);
            throw error;
        }
    }
    static async handleWebhook(event, data) {
        try {
            switch (event) {
                case 'subscription.charged':
                    await this.handleSubscriptionCharged(data);
                    break;
                case 'subscription.cancelled':
                    await this.handleSubscriptionCancelled(data);
                    break;
                case 'subscription.expired':
                    await this.handleSubscriptionExpired(data);
                    break;
                default:
                    logger.info(`Unhandled webhook event: ${event}`);
            }
            return { success: true };
        }
        catch (error) {
            logger.error('Error handling webhook:', error);
            throw error;
        }
    }
    static async handleSubscriptionCharged(data) {
        const { subscription, payment } = data.payload;
        await index_1.prisma.subscription.update({
            where: { razorpaySubId: subscription.id },
            data: {
                currentPeriodStart: new Date(subscription.current_start * 1000),
                currentPeriodEnd: new Date(subscription.current_end * 1000),
                status: 'active'
            }
        });
    }
    static async handleSubscriptionCancelled(data) {
        const { subscription } = data.payload;
        await index_1.prisma.subscription.update({
            where: { razorpaySubId: subscription.id },
            data: {
                status: 'cancelled',
                cancelAtPeriodEnd: true
            }
        });
    }
    static async handleSubscriptionExpired(data) {
        const { subscription } = data.payload;
        await index_1.prisma.subscription.update({
            where: { razorpaySubId: subscription.id },
            data: {
                status: 'expired'
            }
        });
    }
}
exports.RazorpayService = RazorpayService;
//# sourceMappingURL=razorpay.service.js.map