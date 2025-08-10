"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const logger_1 = require("../utils/logger");
const execution_engine_1 = require("../services/execution.engine");
const index_1 = require("../index");
const router = express_1.default.Router();
const logger = (0, logger_1.createLogger)();
router.post('/trigger/:workflowId', async (req, res) => {
    try {
        const { workflowId } = req.params;
        if (!workflowId) {
            return res.status(400).json({
                success: false,
                error: 'Workflow ID is required'
            });
        }
        const triggerData = req.body;
        logger.info('Webhook trigger received', { workflowId, data: triggerData });
        const workflow = await index_1.prisma.workflow.findUnique({
            where: { id: workflowId },
            include: { user: true }
        });
        if (!workflow) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }
        if (!workflow.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Workflow is not active'
            });
        }
        execution_engine_1.ExecutionEngine.executeWorkflow(workflowId, triggerData, 'NORMAL')
            .then(result => {
            logger.info('Webhook-triggered workflow completed', {
                workflowId,
                executionId: result.executionId,
                success: result.success
            });
        })
            .catch(error => {
            logger.error('Webhook-triggered workflow failed', {
                workflowId,
                error: error.message
            });
        });
        return res.json({
            success: true,
            message: 'Workflow triggered successfully',
            workflowId,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger.error('Webhook trigger error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/user/:userId/workflow/:workflowId', async (req, res) => {
    try {
        const { userId, workflowId } = req.params;
        if (!userId || !workflowId) {
            return res.status(400).json({
                success: false,
                error: 'User ID and Workflow ID are required'
            });
        }
        const triggerData = req.body;
        logger.info('User webhook trigger received', { userId, workflowId, data: triggerData });
        const workflow = await index_1.prisma.workflow.findFirst({
            where: {
                id: workflowId,
                userId: userId
            },
            include: { user: true }
        });
        if (!workflow) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found or unauthorized'
            });
        }
        if (!workflow.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Workflow is not active'
            });
        }
        execution_engine_1.ExecutionEngine.executeWorkflow(workflowId, triggerData, 'NORMAL')
            .then(result => {
            logger.info('User webhook-triggered workflow completed', {
                userId,
                workflowId,
                executionId: result.executionId,
                success: result.success
            });
        })
            .catch(error => {
            logger.error('User webhook-triggered workflow failed', {
                userId,
                workflowId,
                error: error.message
            });
        });
        return res.json({
            success: true,
            message: 'Workflow triggered successfully',
            workflowId,
            userId,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger.error('User webhook trigger error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/external/:service/:workflowId', async (req, res) => {
    try {
        const { service, workflowId } = req.params;
        if (!service || !workflowId) {
            return res.status(400).json({
                success: false,
                error: 'Service and Workflow ID are required'
            });
        }
        let triggerData = req.body;
        logger.info('External webhook trigger received', { service, workflowId, data: triggerData });
        switch (service.toLowerCase()) {
            case 'typeform':
                triggerData = transformTypeformData(triggerData);
                break;
            case 'zapier':
                triggerData = transformZapierData(triggerData);
                break;
            case 'stripe':
                triggerData = transformStripeData(triggerData);
                break;
            case 'calendly':
                triggerData = transformCalendlyData(triggerData);
                break;
            default:
                break;
        }
        const workflow = await index_1.prisma.workflow.findUnique({
            where: { id: workflowId },
            include: { user: true }
        });
        if (!workflow) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }
        if (!workflow.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Workflow is not active'
            });
        }
        execution_engine_1.ExecutionEngine.executeWorkflow(workflowId, triggerData, 'NORMAL')
            .then(result => {
            logger.info('External webhook-triggered workflow completed', {
                service,
                workflowId,
                executionId: result.executionId,
                success: result.success
            });
        })
            .catch(error => {
            logger.error('External webhook-triggered workflow failed', {
                service,
                workflowId,
                error: error.message
            });
        });
        return res.json({
            success: true,
            message: 'Workflow triggered successfully',
            service,
            workflowId,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger.error('External webhook trigger error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/test/:workflowId', async (req, res) => {
    try {
        const { workflowId } = req.params;
        if (!workflowId) {
            return res.status(400).json({
                success: false,
                error: 'Workflow ID is required'
            });
        }
        const triggerData = req.body || { test: true, timestamp: new Date().toISOString() };
        logger.info('Test webhook trigger received', { workflowId, data: triggerData });
        const result = await execution_engine_1.ExecutionEngine.executeWorkflow(workflowId, triggerData, 'TEST');
        return res.json({
            success: true,
            message: 'Test workflow executed successfully',
            result,
            workflowId,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger.error('Test webhook trigger error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
function transformTypeformData(data) {
    if (data.form_response) {
        const { form_response } = data;
        const answers = {};
        if (form_response.answers) {
            form_response.answers.forEach((answer) => {
                const field = answer.field?.ref || answer.field?.id || 'unknown';
                answers[field] = answer.text || answer.choice?.label || answer.email || answer.phone_number || answer.number;
            });
        }
        return {
            source: 'typeform',
            form_id: data.form_response?.form_id,
            response_id: data.form_response?.token,
            submitted_at: data.form_response?.submitted_at,
            answers,
            raw_data: data
        };
    }
    return { source: 'typeform', raw_data: data };
}
function transformZapierData(data) {
    return {
        source: 'zapier',
        ...data
    };
}
function transformStripeData(data) {
    if (data.type && data.data) {
        return {
            source: 'stripe',
            event_type: data.type,
            event_id: data.id,
            object: data.data.object,
            raw_data: data
        };
    }
    return { source: 'stripe', raw_data: data };
}
function transformCalendlyData(data) {
    if (data.event) {
        return {
            source: 'calendly',
            event_type: data.event,
            payload: data.payload,
            time: data.time,
            raw_data: data
        };
    }
    return { source: 'calendly', raw_data: data };
}
exports.default = router;
//# sourceMappingURL=webhook.js.map