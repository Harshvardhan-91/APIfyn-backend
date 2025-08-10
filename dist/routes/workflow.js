"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const workflow_service_1 = require("../services/workflow.service");
const router = express_1.default.Router();
const logger = (0, logger_1.createLogger)();
router.get('/', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { page = 1, limit = 20, search, category, isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = { userId: user.id };
    if (search) {
        where.OR = [
            { name: { contains: String(search), mode: 'insensitive' } },
            { description: { contains: String(search), mode: 'insensitive' } },
        ];
    }
    if (category) {
        where.category = String(category);
    }
    if (isActive !== undefined) {
        where.isActive = isActive === 'true';
    }
    const [workflows, total] = await Promise.all([
        index_1.prisma.workflow.findMany({
            where,
            select: {
                id: true,
                name: true,
                description: true,
                category: true,
                tags: true,
                isActive: true,
                isPublic: true,
                triggerType: true,
                totalRuns: true,
                successfulRuns: true,
                failedRuns: true,
                lastExecutedAt: true,
                avgExecutionTime: true,
                createdAt: true,
                updatedAt: true,
            },
            skip,
            take: Number(limit),
            orderBy: { updatedAt: 'desc' },
        }),
        index_1.prisma.workflow.count({ where }),
    ]);
    res.json({
        success: true,
        workflows,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
        },
    });
}));
router.get('/:id', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    if (!id) {
        throw new errorHandler_1.CustomError('Workflow ID is required', 400);
    }
    const workflow = await index_1.prisma.workflow.findFirst({
        where: { id, userId: user.id },
        include: {
            executions: {
                take: 10,
                orderBy: { startedAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    startedAt: true,
                    completedAt: true,
                    duration: true,
                    errorMessage: true,
                },
            },
        },
    });
    if (!workflow) {
        throw new errorHandler_1.CustomError('Workflow not found', 404);
    }
    res.json({
        success: true,
        workflow,
    });
}));
router.post('/', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const workflowData = req.body;
    if (!workflowData.name) {
        throw new errorHandler_1.CustomError('Workflow name is required', 400);
    }
    const workflow = await workflow_service_1.WorkflowService.createWorkflow(user.id, workflowData);
    logger.info('Workflow created', { workflowId: workflow.id, userId: user.id });
    res.status(201).json({
        success: true,
        workflow,
    });
}));
router.post('/:id/execute', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const { triggerData = {}, executionMode = 'NORMAL' } = req.body;
    if (!id) {
        throw new errorHandler_1.CustomError('Workflow ID is required', 400);
    }
    const result = await workflow_service_1.WorkflowService.executeWorkflow(id, triggerData, executionMode);
    res.json({
        success: true,
        execution: result,
    });
}));
router.get('/templates', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { category, search } = req.query;
    const templates = await workflow_service_1.WorkflowService.getWorkflowTemplates(category, search);
    res.json({
        success: true,
        templates,
    });
}));
router.post('/templates/:templateId/clone', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { templateId } = req.params;
    const { customName } = req.body;
    if (!templateId) {
        throw new errorHandler_1.CustomError('Template ID is required', 400);
    }
    const clonedWorkflow = await workflow_service_1.WorkflowService.cloneWorkflowTemplate(user.id, templateId, customName);
    res.status(201).json({
        success: true,
        workflow: clonedWorkflow,
    });
}));
router.put('/:id', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const updateData = req.body;
    if (!id) {
        throw new errorHandler_1.CustomError('Workflow ID is required', 400);
    }
    const workflow = await workflow_service_1.WorkflowService.updateWorkflow(id, user.id, updateData);
    res.json({
        success: true,
        workflow,
    });
}));
router.delete('/:id', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    if (!id) {
        throw new errorHandler_1.CustomError('Workflow ID is required', 400);
    }
    await workflow_service_1.WorkflowService.deleteWorkflow(id, user.id);
    res.json({
        success: true,
        message: 'Workflow deleted successfully',
    });
}));
function getSubscriptionLimits(tier) {
    const limits = {
        FREE: { workflows: 3, executions: 100 },
        STARTER: { workflows: 10, executions: 1000 },
        PROFESSIONAL: { workflows: 50, executions: 10000 },
        ENTERPRISE: { workflows: 200, executions: 100000 },
    };
    return limits[tier] || limits.FREE;
}
exports.default = router;
//# sourceMappingURL=workflow.js.map