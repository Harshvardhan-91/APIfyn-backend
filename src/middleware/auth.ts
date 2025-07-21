import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { User, Subscription, Plan } from '@prisma/client';

// Define type for user with subscription
export type UserWithSubscription = User & {
  subscription: (Subscription & {
    plan: Plan
  }) | null
};

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserWithSubscription;
      firebaseUser?: admin.auth.DecodedIdToken;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: UserWithSubscription;
  firebaseUser: admin.auth.DecodedIdToken;
}

// Firebase ID token verification middleware
export const authenticateFirebaseToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No valid authorization token provided' });
      return;
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      include: {
        subscription: {
          include: {
            plan: true
          }
        }
      }
    });

    if (!user) {
      // Create new user if doesn't exist
      await prisma.user.create({
        data: {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || '',
          displayName: decodedToken.name || null,
          photoURL: decodedToken.picture || null,
          emailVerified: decodedToken.email_verified || false,
          lastLoginAt: new Date(),
        },
      });
    } else {
      // Update last login time
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    if (!user) {
      // Fetch the newly created user with subscription
      user = await prisma.user.findUnique({
        where: { firebaseUid: decodedToken.uid },
        include: {
          subscription: {
            include: {
              plan: true
            }
          }
        }
      });
    }

    if (!user) {
      throw new Error('Failed to create or fetch user');
    }

    req.user = user;
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      error: 'Invalid authentication token',
      details: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

// API key authentication middleware
export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }

    // Hash the provided API key and find in database
    const bcrypt = await import('bcryptjs');
    
    const apiKeys = await prisma.apiKey.findMany({
      where: { isActive: true },
      include: { 
        user: {
          include: {
            subscription: {
              include: {
                plan: true
              }
            }
          }
        }
      },
    });

    let matchedApiKey = null;
    for (const key of apiKeys) {
      if (await bcrypt.compare(apiKey, key.keyHash)) {
        matchedApiKey = key;
        break;
      }
    }

    if (!matchedApiKey) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Check if API key has expired
    if (matchedApiKey.expiresAt && matchedApiKey.expiresAt < new Date()) {
      res.status(401).json({ error: 'API key has expired' });
      return;
    }

    // Update API key usage
    await prisma.apiKey.update({
      where: { id: matchedApiKey.id },
      data: {
        lastUsedAt: new Date(),
        totalRequests: { increment: 1 },
      },
    });

    req.user = matchedApiKey.user;
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(401).json({ error: 'Invalid API key' });
  }
};

// Authorization middleware for role-based access
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

// Subscription tier validation middleware
export const requireSubscription = (minTier: string) => {
  const tierOrder = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
  
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userTier = req.user.subscription?.plan.type || 'FREE';
    const userTierIndex = tierOrder.indexOf(userTier);
    const requiredTierIndex = tierOrder.indexOf(minTier);

    if (userTierIndex < requiredTierIndex) {
      res.status(403).json({ 
        error: 'Subscription upgrade required',
        required: minTier,
        current: userTier,
      });
      return;
    }

    next();
  };
};

// Rate limiting per user
export const userRateLimit = (maxRequests: number, windowMs: number) => {
  const userRequestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const now = Date.now();
    const userId = req.user.id;
    const userLimit = userRequestCounts.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      userRequestCounts.set(userId, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }

    if (userLimit.count >= maxRequests) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000),
      });
      return;
    }

    userLimit.count++;
    next();
  };
};
