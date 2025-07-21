import { prisma } from '../index';
import { Request, Response, NextFunction } from 'express';

export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    res.status(401).json({ error: 'API key required' });
    return;
  }
  const key = await prisma.apiKey.findUnique({
    where: { keyHash: apiKey },
    include: {
      user: {
        include: {
          subscription: {
            include: { plan: true }
          }
        }
      }
    }
  });
  if (!key || !key.isActive || !key.user) {
    res.status(403).json({ error: 'Invalid or inactive API key' });
    return;
  }
  req.user = key.user;
  next();
}
