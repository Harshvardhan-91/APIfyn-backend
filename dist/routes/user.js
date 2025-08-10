"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const index_1 = require("../index");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
const logger = (0, logger_1.createLogger)();
router.get('/dashboard', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const userWithPlan = await index_1.prisma.user.findUnique({
        where: { id: user.id },
        include: {
            subscription: {
                include: { plan: true }
            }
        }
    });
    const [totalWorkflows, activeWorkflows, totalExecutions, recentExecutions, connectedIntegrations,] = await Promise.all([
        index_1.prisma.workflow.count({ where: { userId: user.id } }),
        index_1.prisma.workflow.count({ where: { userId: user.id, isActive: true } }),
        index_1.prisma.workflowExecution.count({ where: { userId: user.id } }),
        index_1.prisma.workflowExecution.findMany({
            where: { userId: user.id },
            include: { workflow: { select: { name: true } } },
            orderBy: { startedAt: 'desc' },
            take: 10,
        }),
        index_1.prisma.integration.count({ where: { userId: user.id, isActive: true } }),
    ]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const executionsToday = await index_1.prisma.workflowExecution.count({
        where: {
            userId: user.id,
            startedAt: { gte: today },
        },
    });
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const executionsThisWeek = await index_1.prisma.workflowExecution.count({
        where: {
            userId: user.id,
            startedAt: { gte: weekStart },
        },
    });
    const recentActivity = recentExecutions.map(execution => ({
        id: execution.id,
        name: execution.workflow.name,
        type: 'workflow_execution',
        status: execution.status.toLowerCase(),
        timestamp: execution.startedAt.toISOString(),
        duration: execution.duration ? `${execution.duration.toFixed(1)}s` : null,
    }));
    res.json({
        success: true,
        data: {
            totalWorkflows,
            activeWorkflows,
            executionsToday,
            thisWeek: executionsThisWeek,
            connectedApps: connectedIntegrations,
            recentActivity,
            stats: {
                totalExecutions,
                successRate: recentExecutions.length > 0
                    ? (recentExecutions.filter(e => e.status === 'SUCCESS').length / recentExecutions.length) * 100
                    : 0,
            },
            plan: {
                type: userWithPlan?.subscription?.plan?.type || 'FREE',
                name: userWithPlan?.subscription?.plan?.name || 'Free',
                workflowsLimit: userWithPlan?.subscription?.plan?.workflowsLimit || 2,
                apiCallsLimit: userWithPlan?.subscription?.plan?.apiCallsLimit || 100,
                workflowsUsed: totalWorkflows,
                apiCallsUsed: userWithPlan?.apiCallsUsed || 0,
                subscriptionStatus: userWithPlan?.subscription?.status || 'inactive',
                subscriptionEndDate: userWithPlan?.subscription?.currentPeriodEnd || null,
            },
        },
    });
}));
router.get('/profile', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { firebaseUid, ...userProfile } = user;
    res.json({
        success: true,
        user: userProfile,
    });
}));
router.put('/profile', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { firstName, lastName, company, jobTitle, displayName } = req.body;
    const updatedUser = await index_1.prisma.user.update({
        where: { id: user.id },
        data: {
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
            company: company || user.company,
            jobTitle: jobTitle || user.jobTitle,
            displayName: displayName || user.displayName,
            updatedAt: new Date(),
        },
    });
    const { firebaseUid, ...userProfile } = updatedUser;
    logger.info(`User profile updated: ${user.email}`);
    res.json({
        success: true,
        user: userProfile,
    });
}));
router.get('/usage', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const [monthlyExecutions, monthlyApiCalls, subscriptionLimits,] = await Promise.all([
        index_1.prisma.workflowExecution.count({
            where: {
                userId: user.id,
                startedAt: { gte: currentMonth },
            },
        }),
        index_1.prisma.workflowExecution.count({
            where: {
                userId: user.id,
                startedAt: { gte: currentMonth },
            },
        }),
        Promise.resolve(getSubscriptionLimits(user.subscription?.plan.type || 'FREE')),
    ]);
    res.json({
        success: true,
        usage: {
            executions: {
                used: monthlyExecutions,
                limit: subscriptionLimits.executions,
                percentage: (monthlyExecutions / subscriptionLimits.executions) * 100,
            },
            apiCalls: {
                used: monthlyApiCalls,
                limit: subscriptionLimits.apiCalls,
                percentage: (monthlyApiCalls / subscriptionLimits.apiCalls) * 100,
            },
            workflows: {
                used: user.workflowsUsed || 0,
                limit: subscriptionLimits.workflows,
                percentage: ((user.workflowsUsed || 0) / subscriptionLimits.workflows) * 100,
            },
        },
        subscription: {
            tier: user.subscription?.plan.type || 'FREE',
            status: user.subscription?.status || 'inactive',
            currentPeriodEnd: user.subscription?.currentPeriodEnd || null,
        },
    });
}));
router.post('/api-keys', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { name, permissions = [], expiresAt } = req.body;
    if (!name) {
        throw new errorHandler_1.CustomError('API key name is required', 400);
    }
    const apiKey = generateApiKey();
    const keyHash = await bcryptjs_1.default.hash(apiKey, 12);
    const keyPreview = apiKey.substring(0, 8) + '...';
    const newApiKey = await index_1.prisma.apiKey.create({
        data: {
            name,
            keyHash,
            keyPreview,
            permissions,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            userId: user.id,
        },
    });
    logger.info(`API key created: ${name} for user ${user.email}`);
    res.json({
        success: true,
        apiKey: {
            id: newApiKey.id,
            name: newApiKey.name,
            key: apiKey,
            keyPreview: newApiKey.keyPreview,
            permissions: newApiKey.permissions,
            expiresAt: newApiKey.expiresAt,
            createdAt: newApiKey.createdAt,
        },
    });
}));
router.get('/api-keys', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const apiKeys = await index_1.prisma.apiKey.findMany({
        where: { userId: user.id },
        select: {
            id: true,
            name: true,
            keyPreview: true,
            permissions: true,
            lastUsedAt: true,
            totalRequests: true,
            expiresAt: true,
            isActive: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json({
        success: true,
        apiKeys,
    });
}));
router.delete('/api-keys/:id', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const apiKey = await index_1.prisma.apiKey.findFirst({
        where: { id, userId: user.id },
    });
    if (!apiKey) {
        throw new errorHandler_1.CustomError('API key not found', 404);
    }
    await index_1.prisma.apiKey.delete({
        where: { id },
    });
    logger.info(`API key deleted: ${apiKey.name} for user ${user.email}`);
    res.json({
        success: true,
        message: 'API key deleted successfully',
    });
}));
router.get('/admin/users', auth_1.authenticateFirebaseToken, (0, auth_1.requireRole)(['ADMIN', 'SUPER_ADMIN']), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 50, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = search ? {
        OR: [
            { email: { contains: String(search), mode: 'insensitive' } },
            { displayName: { contains: String(search), mode: 'insensitive' } },
        ],
    } : {};
    const [users, total] = await Promise.all([
        index_1.prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                subscription: true,
                createdAt: true,
                lastLoginAt: true,
                _count: {
                    select: {
                        workflows: true,
                        executions: true,
                    },
                },
            },
            skip,
            take: Number(limit),
            orderBy: { createdAt: 'desc' },
        }),
        index_1.prisma.user.count({ where }),
    ]);
    res.json({
        success: true,
        users,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
        },
    });
}));
function getSubscriptionLimits(tier) {
    const limits = {
        FREE: { executions: 100, apiCalls: 1000, workflows: 3 },
        STARTER: { executions: 1000, apiCalls: 10000, workflows: 10 },
        PROFESSIONAL: { executions: 10000, apiCalls: 100000, workflows: 50 },
        ENTERPRISE: { executions: 100000, apiCalls: 1000000, workflows: 200 },
    };
    return limits[tier] || limits.FREE;
}
function generateApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'fapi_';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
exports.default = router;
//# sourceMappingURL=user.js.map