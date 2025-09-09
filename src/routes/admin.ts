import express from 'express';
import { authenticateFirebaseToken } from '../middleware/auth';
import { prisma } from '../db';

const router = express.Router();

// Middleware to check admin role
import { Request, Response, NextFunction } from 'express';
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// Get all users
router.get('/users', authenticateFirebaseToken, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany();
  res.json({ success: true, users });
});

// Get all workflows
router.get('/workflows', authenticateFirebaseToken, requireAdmin, async (req, res) => {
  const workflows = await prisma.workflow.findMany();
  res.json({ success: true, workflows });
});

// Get usage metrics
router.get('/metrics', authenticateFirebaseToken, requireAdmin, async (req, res) => {
  // Example: total users, workflows, executions
  const totalUsers = await prisma.user.count();
  const totalWorkflows = await prisma.workflow.count();
  const totalExecutions = await prisma.workflowExecution.count();
  res.json({ success: true, metrics: { totalUsers, totalWorkflows, totalExecutions } });
});

// Manage templates
router.get('/templates', authenticateFirebaseToken, requireAdmin, async (req, res) => {
  const templates = await prisma.workflow.findMany({ where: { isPublic: true } });
  res.json({ success: true, templates });
});

export default router;
