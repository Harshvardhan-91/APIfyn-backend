import { prisma } from '../index';
import { WorkflowExecution } from '@prisma/client';

export class ExecutionService {
  // Log a workflow execution
  static async logExecution(data: {
    workflowId: string;
    userId: string;
    inputData: any;
    outputData?: any;
    status: string;
    errorMessage?: string;
    errorStack?: string;
    startedAt?: Date;
    completedAt?: Date;
    duration?: number;
  }) {
    // Cast status to ExecutionStatus enum
    // Import ExecutionStatus from Prisma
    // @ts-ignore
    const { ExecutionStatus } = require('@prisma/client');
    const statusEnum = ExecutionStatus[data.status.toUpperCase() as keyof typeof ExecutionStatus];
    if (!statusEnum) throw new Error('Invalid execution status');
    return prisma.workflowExecution.create({
      data: {
        ...data,
        status: statusEnum,
      },
    });
  }

  // Get executions for a workflow
  static async getWorkflowExecutions(workflowId: string) {
    return prisma.workflowExecution.findMany({ where: { workflowId } });
  }

  // Get execution by ID
  static async getExecution(id: string) {
    return prisma.workflowExecution.findUnique({ where: { id } });
  }

  // Retry execution (stub)
  static async retryExecution(id: string) {
    // TODO: Add logic to re-run the workflow
    return prisma.workflowExecution.update({ where: { id }, data: { status: 'PENDING' } });
  }
}
