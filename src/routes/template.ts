import express from 'express';
import { TemplateService } from '../services/template.service';
import { authenticateFirebaseToken } from '../middleware/auth';

const router = express.Router();

// Create template
router.post('/', authenticateFirebaseToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) throw new Error('User not authenticated');
    const template = await TemplateService.createTemplate({
      ...req.body,
      createdBy: req.user.id,
    });
    res.json({ success: true, template });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// List templates
router.get('/', async (req, res) => {
  try {
    const templates = await TemplateService.listTemplates();
    res.json({ success: true, templates });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Duplicate template
router.post('/:id/duplicate', authenticateFirebaseToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) throw new Error('User not authenticated');
    if (!req.params.id) throw new Error('Template ID required');
    const template = await TemplateService.duplicateTemplate(req.params.id as string, req.user.id as string);
    res.json({ success: true, template });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
