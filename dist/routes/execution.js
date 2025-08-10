"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const execution_service_1 = require("../services/execution.service");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/', auth_1.authenticateFirebaseToken, async (req, res) => {
    try {
        if (!req.user || !req.user.id)
            throw new Error('User not authenticated');
        const execution = await execution_service_1.ExecutionService.logExecution({
            ...req.body,
            userId: req.user.id,
        });
        res.json({ success: true, execution });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
router.get('/workflow/:workflowId', auth_1.authenticateFirebaseToken, async (req, res) => {
    try {
        if (!req.params.workflowId)
            throw new Error('Workflow ID required');
        const executions = await execution_service_1.ExecutionService.getWorkflowExecutions(req.params.workflowId);
        res.json({ success: true, executions });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
router.get('/:id', auth_1.authenticateFirebaseToken, async (req, res) => {
    try {
        if (!req.params.id)
            throw new Error('Execution ID required');
        const execution = await execution_service_1.ExecutionService.getExecution(req.params.id);
        res.json({ success: true, execution });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
router.post('/:id/retry', auth_1.authenticateFirebaseToken, async (req, res) => {
    try {
        if (!req.params.id)
            throw new Error('Execution ID required');
        const execution = await execution_service_1.ExecutionService.retryExecution(req.params.id);
        res.json({ success: true, execution });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=execution.js.map