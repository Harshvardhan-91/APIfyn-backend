import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { User } from '@prisma/client';


// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      firebaseUser?: admin.auth.DecodedIdToken;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: User;
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
      // Fetch the newly created user
      user = await prisma.user.findUnique({
        where: { firebaseUid: decodedToken.uid }
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
