/*
  Warnings:

  - The values [CANCELLED,TIMEOUT] on the enum `ExecutionStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SCHEDULE,EMAIL,API_CALL,FILE_UPLOAD,DATABASE_CHANGE] on the enum `TriggerType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `isActive` on the `integrations` table. All the data in the column will be lost.
  - You are about to drop the column `lastUsedAt` on the `integrations` table. All the data in the column will be lost.
  - You are about to drop the column `totalCalls` on the `integrations` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `currentStep` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `errorStack` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `executionMode` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `inputData` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `outputData` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `stepsExecuted` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `totalSteps` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `triggerSource` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to alter the column `duration` on the `workflow_executions` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to drop the column `avgExecutionTime` on the `workflows` table. All the data in the column will be lost.
  - You are about to drop the column `failedRuns` on the `workflows` table. All the data in the column will be lost.
  - You are about to drop the column `lastExecutedAt` on the `workflows` table. All the data in the column will be lost.
  - You are about to drop the column `retryAttempts` on the `workflows` table. All the data in the column will be lost.
  - You are about to drop the column `successfulRuns` on the `workflows` table. All the data in the column will be lost.
  - You are about to drop the column `timeout` on the `workflows` table. All the data in the column will be lost.
  - You are about to drop the column `triggerConfig` on the `workflows` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `workflows` table. All the data in the column will be lost.
  - You are about to drop the `api_keys` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workflow_schedules` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "ExecutionStatus_new" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');
ALTER TABLE "workflow_executions" ALTER COLUMN "status" TYPE "ExecutionStatus_new" USING ("status"::text::"ExecutionStatus_new");
ALTER TYPE "ExecutionStatus" RENAME TO "ExecutionStatus_old";
ALTER TYPE "ExecutionStatus_new" RENAME TO "ExecutionStatus";
DROP TYPE "ExecutionStatus_old";
COMMIT;

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'GITHUB';

-- AlterEnum
BEGIN;
CREATE TYPE "TriggerType_new" AS ENUM ('WEBHOOK', 'MANUAL');
ALTER TABLE "workflows" ALTER COLUMN "triggerType" TYPE "TriggerType_new" USING ("triggerType"::text::"TriggerType_new");
ALTER TYPE "TriggerType" RENAME TO "TriggerType_old";
ALTER TYPE "TriggerType_new" RENAME TO "TriggerType";
DROP TYPE "TriggerType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_userId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_userId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_planId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_userId_fkey";

-- DropForeignKey
ALTER TABLE "workflow_schedules" DROP CONSTRAINT "workflow_schedules_workflowId_fkey";

-- AlterTable
ALTER TABLE "integrations" DROP COLUMN "isActive",
DROP COLUMN "lastUsedAt",
DROP COLUMN "totalCalls";

-- AlterTable
ALTER TABLE "plans" DROP COLUMN "type";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role";

-- AlterTable
ALTER TABLE "workflow_executions" DROP COLUMN "createdAt",
DROP COLUMN "currentStep",
DROP COLUMN "errorMessage",
DROP COLUMN "errorStack",
DROP COLUMN "executionMode",
DROP COLUMN "inputData",
DROP COLUMN "outputData",
DROP COLUMN "stepsExecuted",
DROP COLUMN "totalSteps",
DROP COLUMN "triggerSource",
ADD COLUMN     "error" TEXT,
ADD COLUMN     "input" JSONB,
ADD COLUMN     "output" JSONB,
ALTER COLUMN "duration" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "workflows" DROP COLUMN "avgExecutionTime",
DROP COLUMN "failedRuns",
DROP COLUMN "lastExecutedAt",
DROP COLUMN "retryAttempts",
DROP COLUMN "successfulRuns",
DROP COLUMN "timeout",
DROP COLUMN "triggerConfig",
DROP COLUMN "version",
ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT';

-- DropTable
DROP TABLE "api_keys";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "payments";

-- DropTable
DROP TABLE "subscriptions";

-- DropTable
DROP TABLE "workflow_schedules";

-- DropEnum
DROP TYPE "ExecutionMode";

-- DropEnum
DROP TYPE "NotificationType";

-- DropEnum
DROP TYPE "SubscriptionTier";

-- DropEnum
DROP TYPE "UserRole";
