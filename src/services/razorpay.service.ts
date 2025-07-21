import Razorpay from 'razorpay';
import { RazorpayOrder, RazorpaySubscription, RazorpayPayment } from '../types/razorpay';
import { prisma } from '../index';
import { Plan, Payment, User, Subscription, SubscriptionTier } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
});

export class RazorpayService {
  // Create a new subscription
  static async createSubscription(userId: string, planId: string, interval: 'monthly' | 'yearly') {
    try {
      logger.info('Creating subscription', { userId, planId, interval });

      // Get user and plan details
      const [user, plan] = await Promise.all([
        prisma.user.findUnique({ 
          where: { firebaseUid: userId },
          include: { subscription: true }
        }),
        prisma.plan.findFirst({ 
          where: { 
            type: planId.toUpperCase() as SubscriptionTier
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

      // Check if user already has an active subscription
      if (user.subscription && user.subscription.status === 'active') {
        logger.warn('User already has an active subscription', { 
          userId: user.id, 
          subscriptionId: user.subscription.id 
        });
        throw new Error('User already has an active subscription');
      }

      // Calculate total amount based on interval
      const totalAmount = interval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
      const intervalCount = interval === 'monthly' ? 1 : 12;

      // Create a Razorpay Plan first
      const razorpayPlan = await razorpay.plans.create({
        period: interval === 'monthly' ? 'monthly' : 'yearly',
        interval: 1,
        item: {
          name: plan.name,
          amount: totalAmount * 100, // Convert to paise
          currency: 'INR',
          description: plan.description
        },
        notes: {
          planType: plan.type,
          planId: plan.id
        }
      });

      // Create Razorpay subscription using the created plan
      const subscription = await razorpay.subscriptions.create({
        plan_id: razorpayPlan.id,
        customer_notify: 1,
        total_count: 12, // Auto-renew for 1 year
        notes: {
          userId: user.id,
          planId: plan.id,
          firebaseUid: user.firebaseUid
        }
      });

      // Create subscription record in database
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const nextPeriod = currentTimestamp + (interval === 'monthly' ? 30 * 24 * 60 * 60 : 365 * 24 * 60 * 60);
      
      const dbSubscription = await prisma.subscription.create({
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
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  // Handle successful payment
  static async handlePaymentSuccess(paymentId: string, orderId: string, signature: string) {
    try {
      // Verify payment signature
      const body = JSON.stringify({
        payment_id: paymentId,
        order_id: orderId
      });
      
      const isValid = Razorpay.validateWebhookSignature(
        body,
        signature,
        process.env.RAZORPAY_WEBHOOK_SECRET!
      );

      if (!isValid) {
        throw new Error('Invalid payment signature');
      }

      // Get payment details from Razorpay
      const payment = await razorpay.payments.fetch(paymentId);
      
      // Find subscription by order ID
      const subscription = await prisma.subscription.findFirst({
        where: { razorpaySubId: payment.order_id }
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Record payment in database
      await prisma.payment.create({
        data: {
          razorpayPaymentId: paymentId,
          razorpayOrderId: orderId,
          razorpaySignature: signature,
          amount: Number(payment.amount) / 100, // Convert from paise to rupees
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

      // Update subscription status if needed
      if (payment.status === 'captured') {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'active' }
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error handling payment success:', error);
      throw error;
    }
  }

  // Cancel subscription
  static async cancelSubscription(userId: string, subscriptionId: string) {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          userId: userId
        }
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Cancel on Razorpay
      if (subscription.razorpaySubId) {
        await razorpay.subscriptions.cancel(subscription.razorpaySubId);
      }

      // Update in database
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'cancelled',
          cancelAtPeriodEnd: true
        }
      });

      return { success: true };
    } catch (error) {
      logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  // Handle webhook events
  static async handleWebhook(event: string, data: any) {
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
    } catch (error) {
      logger.error('Error handling webhook:', error);
      throw error;
    }
  }

  private static async handleSubscriptionCharged(data: any) {
    // Handle successful subscription charge
    const { subscription, payment } = data.payload;
    
    await prisma.subscription.update({
      where: { razorpaySubId: subscription.id },
      data: {
        currentPeriodStart: new Date(subscription.current_start * 1000),
        currentPeriodEnd: new Date(subscription.current_end * 1000),
        status: 'active'
      }
    });
  }

  private static async handleSubscriptionCancelled(data: any) {
    const { subscription } = data.payload;
    
    await prisma.subscription.update({
      where: { razorpaySubId: subscription.id },
      data: {
        status: 'cancelled',
        cancelAtPeriodEnd: true
      }
    });
  }

  private static async handleSubscriptionExpired(data: any) {
    const { subscription } = data.payload;
    
    await prisma.subscription.update({
      where: { razorpaySubId: subscription.id },
      data: {
        status: 'expired'
      }
    });
  }
}
