"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dashboard_service_1 = require("../services/dashboard.service");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/stats', auth_1.authenticateFirebaseToken, async (req, res) => {
    try {
        if (!req.user || !req.user.id)
            throw new Error('User not authenticated');
        const stats = await dashboard_service_1.DashboardService.getUserStats(req.user.id);
        res.json({ success: true, stats });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
router.get('/executions', auth_1.authenticateFirebaseToken, async (req, res) => {
    try {
        if (!req.user || !req.user.id)
            throw new Error('User not authenticated');
        const executions = await dashboard_service_1.DashboardService.getRecentExecutions(req.user.id);
        res.json({ success: true, executions });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map