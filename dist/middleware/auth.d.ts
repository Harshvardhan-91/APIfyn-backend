import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { User, Subscription, Plan } from '@prisma/client';
export type UserWithSubscription = User & {
    subscription: (Subscription & {
        plan: Plan;
    }) | null;
};
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
export declare const authenticateFirebaseToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const authenticateApiKey: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requireSubscription: (minTier: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const userRateLimit: (maxRequests: number, windowMs: number) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map