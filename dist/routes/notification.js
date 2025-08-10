"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notification_service_1 = require("../services/notification.service");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/', auth_1.authenticateFirebaseToken, async (req, res) => {
    try {
        if (!req.user || !req.user.id)
            throw new Error('User not authenticated');
        const notifications = await notification_service_1.NotificationService.getUserNotifications(req.user.id);
        res.json({ success: true, notifications });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
router.post('/:id/read', auth_1.authenticateFirebaseToken, async (req, res) => {
    try {
        if (!req.params.id)
            throw new Error('Notification ID required');
        const notification = await notification_service_1.NotificationService.markAsRead(req.params.id);
        res.json({ success: true, notification });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=notification.js.map