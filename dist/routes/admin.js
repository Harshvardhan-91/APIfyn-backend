"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const index_1 = require("../index");
const router = express_1.default.Router();
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
}
router.get('/users', auth_1.authenticateFirebaseToken, requireAdmin, async (req, res) => {
    const users = await index_1.prisma.user.findMany();
    res.json({ success: true, users });
});
router.get('/workflows', auth_1.authenticateFirebaseToken, requireAdmin, async (req, res) => {
    const workflows = await index_1.prisma.workflow.findMany();
    res.json({ success: true, workflows });
});
router.get('/metrics', auth_1.authenticateFirebaseToken, requireAdmin, async (req, res) => {
    const totalUsers = await index_1.prisma.user.count();
    const totalWorkflows = await index_1.prisma.workflow.count();
    const totalExecutions = await index_1.prisma.workflowExecution.count();
    res.json({ success: true, metrics: { totalUsers, totalWorkflows, totalExecutions } });
});
router.get('/templates', auth_1.authenticateFirebaseToken, requireAdmin, async (req, res) => {
    const templates = await index_1.prisma.workflow.findMany({ where: { isPublic: true } });
    res.json({ success: true, templates });
});
exports.default = router;
//# sourceMappingURL=admin.js.map