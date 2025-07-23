import { prisma } from '../index';
import { Workflow, WorkflowExecution } from '@prisma/client';
import { createLogger } from '../utils/logger';
import { ExecutionService } from './execution.service';

const logger = createLogger();

export class WorkflowService {
  // Create a new workflow
  static async createWorkflow(userId: string, workflowData: any) {
    try {
      logger.info('Creating new workflow', { userId, name: workflowData.name });

      // Check user's workflow limit based on subscription
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: { include: { plan: true } } }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get user's current workflow count
      const currentWorkflowCount = await prisma.workflow.count({
        where: { userId }
      });

      // Determine workflow limit based on plan
      let workflowLimit = parseInt(process.env.FREE_PLAN_WORKFLOWS || '2');
      if (user.subscription?.plan?.type === 'PRO') {
        workflowLimit = parseInt(process.env.PRO_PLAN_WORKFLOWS || '50');
      } else if (user.subscription?.plan?.type === 'PREMIUM') {
        workflowLimit = parseInt(process.env.PREMIUM_PLAN_WORKFLOWS || '999999');
      }

      if (currentWorkflowCount >= workflowLimit) {
        throw new Error(`Workflow limit reached. Upgrade your plan to create more workflows.`);
      }

      // Cast triggerType to enum
      const { TriggerType } = require('@prisma/client');
      const triggerTypeEnum = TriggerType[workflowData.triggerType?.toUpperCase() as keyof typeof TriggerType] || TriggerType.MANUAL;

      // Create the workflow
      const workflow = await prisma.workflow.create({
        data: {
          name: workflowData.name,
          description: workflowData.description || '',
          definition: workflowData.definition || {},
          category: workflowData.category || 'general',
          tags: workflowData.tags || [],
          triggerType: triggerTypeEnum,
          triggerConfig: workflowData.triggerConfig || {},
          isActive: workflowData.isActive !== false,
          isPublic: workflowData.isPublic || false,
          userId,
        }
      });

      // Update user's workflow count
      await prisma.user.update({
        where: { id: userId },
        data: { workflowsUsed: currentWorkflowCount + 1 }
      });

      logger.info('Workflow created successfully', { workflowId: workflow.id });
      return workflow;
    } catch (error) {
      logger.error('Error creating workflow:', error);
      throw error;
    }
  }

  // Get all workflows for a user
  static async getUserWorkflows(userId: string) {
    return prisma.workflow.findMany({ 
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
  }

  // Get a single workflow
  static async getWorkflow(id: string) {
    return prisma.workflow.findUnique({ 
      where: { id },
      include: {
        executions: {
          take: 10,
          orderBy: { startedAt: 'desc' }
        }
      }
    });
  }

  // Update a workflow
  static async updateWorkflow(id: string, userId: string, data: any) {
    try {
      const workflow = await prisma.workflow.findFirst({
        where: { id, userId }
      });

      if (!workflow) {
        throw new Error('Workflow not found or unauthorized');
      }

      const updatedWorkflow = await prisma.workflow.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
          version: { increment: 1 }
        }
      });

      logger.info('Workflow updated', { workflowId: id, userId });
      return updatedWorkflow;
    } catch (error) {
      logger.error('Error updating workflow:', error);
      throw error;
    }
  }

  // Delete a workflow
  static async deleteWorkflow(id: string, userId: string) {
    try {
      const workflow = await prisma.workflow.findFirst({
        where: { id, userId }
      });

      if (!workflow) {
        throw new Error('Workflow not found or unauthorized');
      }

      await prisma.workflow.delete({ where: { id } });

      // Update user's workflow count
      await prisma.user.update({
        where: { id: userId },
        data: { workflowsUsed: { decrement: 1 } }
      });

      logger.info('Workflow deleted', { workflowId: id, userId });
      return { success: true };
    } catch (error) {
      logger.error('Error deleting workflow:', error);
      throw error;
    }
  }

  // Execute a workflow
  static async executeWorkflow(workflowId: string, triggerData: any = {}, executionMode: 'NORMAL' | 'TEST' = 'NORMAL') {
    try {
      logger.info('Executing workflow', { workflowId, executionMode });

      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { user: { include: { subscription: { include: { plan: true } } } } }
      });

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      if (!workflow.isActive && executionMode !== 'TEST') {
        throw new Error('Workflow is not active');
      }

      // Check execution limits for the user
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const monthlyExecutions = await prisma.workflowExecution.count({
        where: {
          userId: workflow.userId,
          startedAt: { gte: currentMonth }
        }
      });

      // Determine execution limit based on plan
      let executionLimit = parseInt(process.env.FREE_PLAN_API_CALLS || '100');
      if (workflow.user.subscription?.plan?.type === 'PRO') {
        executionLimit = parseInt(process.env.PRO_PLAN_API_CALLS || '10000');
      } else if (workflow.user.subscription?.plan?.type === 'PREMIUM') {
        executionLimit = parseInt(process.env.PREMIUM_PLAN_API_CALLS || '999999');
      }

      if (monthlyExecutions >= executionLimit && executionMode !== 'TEST') {
        throw new Error(`Monthly execution limit reached. Upgrade your plan for more executions.`);
      }

      // Create execution record
      const execution = await prisma.workflowExecution.create({
        data: {
          status: 'RUNNING',
          inputData: triggerData,
          executionMode,
          triggerSource: 'MANUAL',
          workflowId,
          userId: workflow.userId,
        }
      });

      // Simulate workflow execution for now (will be replaced with real execution engine)
      const startTime = Date.now();
      let success = true;
      let error = null;
      let output: any = { result: 'Workflow executed successfully', data: triggerData };

      try {
        // TODO: Implement real workflow execution logic here
        // For now, simulate a delay
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (executionError: any) {
        success = false;
        error = executionError.message;
        output = { result: 'Execution failed', data: triggerData };
      }

      const duration = (Date.now() - startTime) / 1000;

      // Update execution with results
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: success ? 'SUCCESS' : 'FAILED',
          completedAt: new Date(),
          duration,
          outputData: output,
          errorMessage: error,
        }
      });

      // Update workflow statistics
      if (success) {
        await prisma.workflow.update({
          where: { id: workflowId },
          data: {
            totalRuns: { increment: 1 },
            successfulRuns: { increment: 1 },
            lastExecutedAt: new Date(),
          }
        });
      } else {
        await prisma.workflow.update({
          where: { id: workflowId },
          data: {
            totalRuns: { increment: 1 },
            failedRuns: { increment: 1 },
            lastExecutedAt: new Date(),
          }
        });
      }

      logger.info('Workflow execution completed', { 
        executionId: execution.id, 
        success 
      });

      return {
        executionId: execution.id,
        success,
        output,
        error,
        duration
      };
    } catch (error) {
      logger.error('Error executing workflow:', error);
      throw error;
    }
  }

  // Get workflow templates (public workflows)
  static async getWorkflowTemplates(category?: string, search?: string) {
    try {
      const where: any = { isPublic: true };
      
      if (category && category !== 'all') {
        where.category = category;
      }
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } }
        ];
      }

      const templates = await prisma.workflow.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          tags: true,
          definition: true,
          totalRuns: true,
          createdAt: true,
          user: {
            select: {
              displayName: true,
              email: true
            }
          }
        },
        orderBy: [
          { totalRuns: 'desc' },
          { createdAt: 'desc' }
        ],
        take: 50
      });

      return templates;
    } catch (error) {
      logger.error('Error fetching workflow templates:', error);
      throw error;
    }
  }

  // Clone a workflow template
  static async cloneWorkflowTemplate(userId: string, templateId: string, customName?: string) {
    try {
      const template = await prisma.workflow.findFirst({
        where: { id: templateId, isPublic: true }
      });

      if (!template) {
        throw new Error('Template not found or not public');
      }

      // Create a new workflow based on the template
      const clonedWorkflow = await this.createWorkflow(userId, {
        name: customName || `${template.name} (Copy)`,
        description: template.description,
        definition: template.definition,
        category: template.category,
        tags: template.tags,
        triggerType: template.triggerType,
        triggerConfig: template.triggerConfig,
        isActive: false, // Start as inactive so user can configure
        isPublic: false
      });

      logger.info('Workflow template cloned', { 
        templateId, 
        newWorkflowId: clonedWorkflow.id,
        userId 
      });

      return clonedWorkflow;
    } catch (error) {
      logger.error('Error cloning workflow template:', error);
      throw error;
    }
  }
}
