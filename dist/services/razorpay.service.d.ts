export declare class RazorpayService {
    static createSubscription(userId: string, planId: string, interval: 'monthly' | 'yearly'): Promise<{
        subscription: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            razorpaySubId: string | null;
            status: string;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            cancelAtPeriodEnd: boolean;
            interval: string;
            intervalCount: number;
            planId: string;
            userId: string;
        };
        razorpayKey: string | undefined;
    }>;
    static handlePaymentSuccess(paymentId: string, orderId: string, signature: string): Promise<{
        success: boolean;
    }>;
    static cancelSubscription(userId: string, subscriptionId: string): Promise<{
        success: boolean;
    }>;
    static handleWebhook(event: string, data: any): Promise<{
        success: boolean;
    }>;
    private static handleSubscriptionCharged;
    private static handleSubscriptionCancelled;
    private static handleSubscriptionExpired;
}
//# sourceMappingURL=razorpay.service.d.ts.map