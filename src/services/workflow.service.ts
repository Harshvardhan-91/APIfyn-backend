import { prisma } from '../index';
import { Workflow, WorkflowExecution } from '@prisma/client';

export class WorkflowService {
  // Create a new workflow
  static async createWorkflow(data: {
    name: string;
    description?: string;
    definition: any;
    triggerType: string;
    userId: string;
    [key: string]: any;
  }) {
    if (!data.userId) throw new Error('userId is required');
    // Cast triggerType to enum
    // Import TriggerType from Prisma
    // @ts-ignore
    const { TriggerType } = require('@prisma/client');
    const triggerTypeEnum = TriggerType[data.triggerType.toUpperCase() as keyof typeof TriggerType];
    if (!triggerTypeEnum) throw new Error('Invalid triggerType');
    return prisma.workflow.create({
      data: {
        ...data,
        triggerType: triggerTypeEnum,
      },
    });
  }

  // Get all workflows for a user
  static async getUserWorkflows(userId: string) {
    return prisma.workflow.findMany({ where: { userId } });
  }

  // Get a single workflow
  static async getWorkflow(id: string) {
    return prisma.workflow.findUnique({ where: { id } });
  }

  // Update a workflow
  static async updateWorkflow(id: string, data: Parameters<typeof prisma.workflow.update>[0]['data']) {
    return prisma.workflow.update({ where: { id }, data });
  }

  // Delete a workflow
  static async deleteWorkflow(id: string) {
    return prisma.workflow.delete({ where: { id } });
  }

  // Execute a workflow (stub)
  static async executeWorkflow(id: string, inputData: any) {
    // TODO: Add logic for triggers, actions, AI blocks
    return prisma.workflowExecution.create({
      data: {
        workflowId: id,
        inputData,
        status: 'PENDING',
        userId: '', // Fill from context
      },
    });
  }
}
