-- We don't need to create the enum since it already exists

-- CreateTable
CREATE TABLE "plans" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "monthlyPrice" DOUBLE PRECISION NOT NULL,
  "yearlyPrice" DOUBLE PRECISION NOT NULL,
  "features" TEXT[] NOT NULL,
  "apiCallsLimit" INTEGER NOT NULL,
  "workflowsLimit" INTEGER NOT NULL,
  "type" "SubscriptionTier" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateTable
CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL,
  "razorpaySubId" TEXT,
  "status" TEXT NOT NULL,
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "interval" TEXT NOT NULL,
  "intervalCount" INTEGER NOT NULL DEFAULT 1,
  "planId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "razorpayPaymentId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL,
  "orderType" TEXT NOT NULL,
  "razorpayOrderId" TEXT,
  "razorpaySignature" TEXT,
  "subscriptionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_razorpaySubId_key" ON "subscriptions"("razorpaySubId");
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE UNIQUE INDEX "payments_razorpayPaymentId_key" ON "payments"("razorpayPaymentId");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert initial plans
INSERT INTO "plans" (
  "id", 
  "name", 
  "description", 
  "monthlyPrice", 
  "yearlyPrice", 
  "features", 
  "apiCallsLimit", 
  "workflowsLimit",
  "type",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    gen_random_uuid(), 
    'Starter',
    'Perfect for individuals getting started with automation workflows.',
    0,
    0,
    ARRAY[
      'Up to 100 API calls per month',
      '5 automation workflows',
      'Basic integrations (10+ apps)',
      'Email notifications',
      'Community support',
      'Standard templates'
    ],
    100,
    5,
    'STARTER',
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Professional',
    'Advanced automation for growing teams and businesses.',
    2000,
    19200,
    ARRAY[
      'Up to 10,000 API calls per month',
      'Unlimited automation workflows',
      'Premium integrations (100+ apps)',
      'Real-time monitoring & alerts',
      'Priority email support',
      'Custom workflow templates',
      'Advanced analytics dashboard',
      'Webhook support'
    ],
    10000,
    -1,
    'PROFESSIONAL',
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Enterprise',
    'Complete automation solution for large-scale operations.',
    3000,
    30000,
    ARRAY[
      'Unlimited API calls',
      'Advanced workflow automation',
      'All premium integrations + custom APIs',
      '24/7 dedicated support',
      'Custom onboarding & training',
      'Advanced security & compliance',
      'White-label options',
      'SLA guarantees'
    ],
    -1,
    -1,
    'ENTERPRISE',
    NOW(),
    NOW()
  )
ON CONFLICT (name) DO UPDATE 
SET 
  "description" = EXCLUDED.description,
  "monthlyPrice" = EXCLUDED.monthlyPrice,
  "yearlyPrice" = EXCLUDED.yearlyPrice,
  "features" = EXCLUDED.features,
  "apiCallsLimit" = EXCLUDED.apiCallsLimit,
  "workflowsLimit" = EXCLUDED.workflowsLimit,
  "type" = EXCLUDED.type,
  "updatedAt" = NOW();
