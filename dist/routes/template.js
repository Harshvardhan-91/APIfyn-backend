"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const template_service_1 = require("../services/template.service");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/', auth_1.authenticateFirebaseToken, async (req, res) => {
    try {
        if (!req.user || !req.user.id)
            throw new Error('User not authenticated');
        const template = await template_service_1.TemplateService.createTemplate({
            ...req.body,
            createdBy: req.user.id,
        });
        res.json({ success: true, template });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
router.get('/', async (req, res) => {
    try {
        const templates = await template_service_1.TemplateService.listTemplates();
        res.json({ success: true, templates });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
router.post('/:id/duplicate', auth_1.authenticateFirebaseToken, async (req, res) => {
    try {
        if (!req.user || !req.user.id)
            throw new Error('User not authenticated');
        if (!req.params.id)
            throw new Error('Template ID required');
        const template = await template_service_1.TemplateService.duplicateTemplate(req.params.id, req.user.id);
        res.json({ success: true, template });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=template.js.map