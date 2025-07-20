-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('MANUAL', 'WEBHOOK', 'SCHEDULE', 'EMAIL', 'API_CALL', 'FILE_UPLOAD', 'DATABASE_CHANGE');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('NORMAL', 'TEST', 'DEBUG');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('GMAIL', 'SLACK', 'NOTION', 'GOOGLE_SHEETS', 'AIRTABLE', 'SALESFORCE', 'HUBSPOT', 'WEBHOOK', 'REST_API', 'GRAPHQL', 'DATABASE', 'FTP', 'SFTP', 'AWS_S3', 'DROPBOX', 'GOOGLE_DRIVE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'WORKFLOW_COMPLETE', 'WORKFLOW_FAILED', 'INTEGRATION_CONNECTED', 'INTEGRATION_DISCONNECTED', 'SUBSCRIPTION_UPDATED', 'QUOTA_WARNING', 'QUOTA_EXCEEDED');

-- Create all tables
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "photoURL" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "apiCallsUsed" INTEGER NOT NULL DEFAULT 0,
    "workflowsCount" INTEGER NOT NULL DEFAULT 0,
    "integrationsCount" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "yearlyPrice" DOUBLE PRECISION NOT NULL,
    "features" TEXT[],
    "apiCallsLimit" INTEGER NOT NULL,
    "workflowsLimit" INTEGER NOT NULL,
    "type" "SubscriptionTier" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

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

-- Create indexes
CREATE UNIQUE INDEX "users_firebaseUid_key" ON "users"("firebaseUid");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");
CREATE UNIQUE INDEX "subscriptions_razorpaySubId_key" ON "subscriptions"("razorpaySubId");
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE UNIQUE INDEX "payments_razorpayPaymentId_key" ON "payments"("razorpayPaymentId");

-- Add foreign key constraints
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert initial plans
INSERT INTO "plans" ("id", "name", "description", "monthlyPrice", "yearlyPrice", "features", "apiCallsLimit", "workflowsLimit", "type", "createdAt", "updatedAt")
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
