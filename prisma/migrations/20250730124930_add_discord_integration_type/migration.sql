/*
  Warnings:

  - The values [SHEETS,DRIVE,CALENDAR,TYPEFORM,ZAPIER] on the enum `IntegrationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `key` on the `api_keys` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `api_keys` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `error` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `input` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `output` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `lastRunAt` on the `workflows` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `workflows` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[keyHash]` on the table `api_keys` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[razorpayPaymentId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[razorpaySubId]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `keyHash` to the `api_keys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `keyPreview` to the `api_keys` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `notifications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `status` on the `workflow_executions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('NORMAL', 'TEST', 'DEBUG');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'WORKFLOW_COMPLETE', 'WORKFLOW_FAILED', 'INTEGRATION_CONNECTED', 'INTEGRATION_DISCONNECTED', 'SUBSCRIPTION_UPDATED', 'QUOTA_WARNING', 'QUOTA_EXCEEDED');

-- AlterEnum
BEGIN;
CREATE TYPE "IntegrationType_new" AS ENUM ('GMAIL', 'SLACK', 'NOTION', 'DISCORD', 'GOOGLE_SHEETS', 'AIRTABLE', 'SALESFORCE', 'HUBSPOT', 'WEBHOOK', 'REST_API', 'GRAPHQL', 'DATABASE', 'FTP', 'SFTP', 'AWS_S3', 'DROPBOX', 'GOOGLE_DRIVE', 'CUSTOM');
ALTER TABLE "integrations" ALTER COLUMN "type" TYPE "IntegrationType_new" USING ("type"::text::"IntegrationType_new");
ALTER TYPE "IntegrationType" RENAME TO "IntegrationType_old";
ALTER TYPE "IntegrationType_new" RENAME TO "IntegrationType";
DROP TYPE "IntegrationType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "TriggerType" ADD VALUE 'DATABASE_CHANGE';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_userId_fkey";

-- DropForeignKey
ALTER TABLE "integrations" DROP CONSTRAINT "integrations_userId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "workflow_executions" DROP CONSTRAINT "workflow_executions_userId_fkey";

-- DropForeignKey
ALTER TABLE "workflow_executions" DROP CONSTRAINT "workflow_executions_workflowId_fkey";

-- DropForeignKey
ALTER TABLE "workflows" DROP CONSTRAINT "workflows_userId_fkey";

-- DropIndex
DROP INDEX "api_keys_key_key";

-- AlterTable
ALTER TABLE "api_keys" DROP COLUMN "key",
DROP COLUMN "updatedAt",
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "keyHash" TEXT NOT NULL,
ADD COLUMN     "keyPreview" TEXT NOT NULL,
ADD COLUMN     "permissions" TEXT[],
ADD COLUMN     "rateLimit" INTEGER,
ADD COLUMN     "totalRequests" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "integrations" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "totalCalls" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "updatedAt",
ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "readAt" TIMESTAMP(3),
DROP COLUMN "type",
ADD COLUMN     "type" "NotificationType" NOT NULL;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "updatedAt",
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "workflow_executions" DROP COLUMN "error",
DROP COLUMN "input",
DROP COLUMN "output",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currentStep" INTEGER,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "errorStack" TEXT,
ADD COLUMN     "executionMode" "ExecutionMode" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "inputData" JSONB,
ADD COLUMN     "outputData" JSONB,
ADD COLUMN     "stepsExecuted" JSONB[],
ADD COLUMN     "totalSteps" INTEGER,
ADD COLUMN     "triggerSource" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "ExecutionStatus" NOT NULL,
ALTER COLUMN "duration" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "workflows" DROP COLUMN "lastRunAt",
DROP COLUMN "status",
ADD COLUMN     "avgExecutionTime" DOUBLE PRECISION,
ADD COLUMN     "failedRuns" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastExecutedAt" TIMESTAMP(3),
ADD COLUMN     "retryAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "successfulRuns" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "timeout" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "triggerConfig" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- DropEnum
DROP TYPE "WorkflowStatus";

-- CreateTable
CREATE TABLE "workflow_schedules" (
    "id" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workflowId" TEXT NOT NULL,

    CONSTRAINT "workflow_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpayPaymentId_key" ON "payments"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_razorpaySubId_key" ON "subscriptions"("razorpaySubId");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_schedules" ADD CONSTRAINT "workflow_schedules_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
