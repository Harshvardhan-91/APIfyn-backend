"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowService = void 0;
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const execution_engine_1 = require("./execution.engine");
const logger = (0, logger_1.createLogger)();
class WorkflowService {
    static async createWorkflow(userId, workflowData) {
        try {
            logger.info('Creating new workflow', { userId, name: workflowData.name });
            const user = await index_1.prisma.user.findUnique({
                where: { id: userId },
                include: { subscription: { include: { plan: true } } }
            });
            if (!user) {
                throw new Error('User not found');
            }
            const currentWorkflowCount = await index_1.prisma.workflow.count({
                where: { userId }
            });
            let workflowLimit = parseInt(process.env.FREE_PLAN_WORKFLOWS || '2');
            if (user.subscription?.plan?.type === 'PRO') {
                workflowLimit = parseInt(process.env.PRO_PLAN_WORKFLOWS || '50');
            }
            else if (user.subscription?.plan?.type === 'PREMIUM') {
                workflowLimit = parseInt(process.env.PREMIUM_PLAN_WORKFLOWS || '999999');
            }
            if (currentWorkflowCount >= workflowLimit) {
                throw new Error(`Workflow limit reached. Upgrade your plan to create more workflows.`);
            }
            const { TriggerType } = require('@prisma/client');
            const triggerTypeEnum = TriggerType[workflowData.triggerType?.toUpperCase()] || TriggerType.MANUAL;
            const workflow = await index_1.prisma.workflow.create({
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
            await index_1.prisma.user.update({
                where: { id: userId },
                data: { workflowsUsed: currentWorkflowCount + 1 }
            });
            logger.info('Workflow created successfully', { workflowId: workflow.id });
            return workflow;
        }
        catch (error) {
            logger.error('Error creating workflow:', error);
            throw error;
        }
    }
    static async getUserWorkflows(userId) {
        return index_1.prisma.workflow.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' }
        });
    }
    static async getWorkflow(id) {
        return index_1.prisma.workflow.findUnique({
            where: { id },
            include: {
                executions: {
                    take: 10,
                    orderBy: { startedAt: 'desc' }
                }
            }
        });
    }
    static async updateWorkflow(id, userId, data) {
        try {
            const workflow = await index_1.prisma.workflow.findFirst({
                where: { id, userId }
            });
            if (!workflow) {
                throw new Error('Workflow not found or unauthorized');
            }
            const updatedWorkflow = await index_1.prisma.workflow.update({
                where: { id },
                data: {
                    ...data,
                    updatedAt: new Date(),
                    version: { increment: 1 }
                }
            });
            logger.info('Workflow updated', { workflowId: id, userId });
            return updatedWorkflow;
        }
        catch (error) {
            logger.error('Error updating workflow:', error);
            throw error;
        }
    }
    static async deleteWorkflow(id, userId) {
        try {
            const workflow = await index_1.prisma.workflow.findFirst({
                where: { id, userId }
            });
            if (!workflow) {
                throw new Error('Workflow not found or unauthorized');
            }
            await index_1.prisma.workflow.delete({ where: { id } });
            await index_1.prisma.user.update({
                where: { id: userId },
                data: { workflowsUsed: { decrement: 1 } }
            });
            logger.info('Workflow deleted', { workflowId: id, userId });
            return { success: true };
        }
        catch (error) {
            logger.error('Error deleting workflow:', error);
            throw error;
        }
    }
    static async executeWorkflow(workflowId, triggerData = {}, executionMode = 'NORMAL') {
        try {
            logger.info('Executing workflow', { workflowId, executionMode });
            const workflow = await index_1.prisma.workflow.findUnique({
                where: { id: workflowId },
                include: { user: { include: { subscription: { include: { plan: true } } } } }
            });
            if (!workflow) {
                throw new Error('Workflow not found');
            }
            if (!workflow.isActive && executionMode !== 'TEST') {
                throw new Error('Workflow is not active');
            }
            const currentMonth = new Date();
            currentMonth.setDate(1);
            currentMonth.setHours(0, 0, 0, 0);
            const monthlyExecutions = await index_1.prisma.workflowExecution.count({
                where: {
                    userId: workflow.userId,
                    startedAt: { gte: currentMonth }
                }
            });
            let executionLimit = parseInt(process.env.FREE_PLAN_API_CALLS || '100');
            if (workflow.user.subscription?.plan?.type === 'PRO') {
                executionLimit = parseInt(process.env.PRO_PLAN_API_CALLS || '10000');
            }
            else if (workflow.user.subscription?.plan?.type === 'PREMIUM') {
                executionLimit = parseInt(process.env.PREMIUM_PLAN_API_CALLS || '999999');
            }
            if (monthlyExecutions >= executionLimit && executionMode !== 'TEST') {
                throw new Error(`Monthly execution limit reached. Upgrade your plan for more executions.`);
            }
            const result = await execution_engine_1.ExecutionEngine.executeWorkflow(workflowId, triggerData, executionMode);
            logger.info('Workflow execution completed', {
                executionId: result.executionId,
                success: result.success
            });
            return result;
        }
        catch (error) {
            logger.error('Error executing workflow:', error);
            throw error;
        }
    }
    static async getWorkflowTemplates(category, search) {
        try {
            const where = { isPublic: true };
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
            const templates = await index_1.prisma.workflow.findMany({
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
        }
        catch (error) {
            logger.error('Error fetching workflow templates:', error);
            throw error;
        }
    }
    static async cloneWorkflowTemplate(userId, templateId, customName) {
        try {
            const template = await index_1.prisma.workflow.findFirst({
                where: { id: templateId, isPublic: true }
            });
            if (!template) {
                throw new Error('Template not found or not public');
            }
            const clonedWorkflow = await this.createWorkflow(userId, {
                name: customName || `${template.name} (Copy)`,
                description: template.description,
                definition: template.definition,
                category: template.category,
                tags: template.tags,
                triggerType: template.triggerType,
                triggerConfig: template.triggerConfig,
                isActive: false,
                isPublic: false
            });
            logger.info('Workflow template cloned', {
                templateId,
                newWorkflowId: clonedWorkflow.id,
                userId
            });
            return clonedWorkflow;
        }
        catch (error) {
            logger.error('Error cloning workflow template:', error);
            throw error;
        }
    }
}
exports.WorkflowService = WorkflowService;
//# sourceMappingURL=workflow.service.js.map