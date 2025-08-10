"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRateLimit = exports.requireSubscription = exports.requireRole = exports.authenticateApiKey = exports.authenticateFirebaseToken = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const index_1 = require("../index");
const authenticateFirebaseToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No valid authorization token provided' });
            return;
        }
        const idToken = authHeader.substring(7);
        const decodedToken = await firebase_admin_1.default.auth().verifyIdToken(idToken);
        let user = await index_1.prisma.user.findUnique({
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
            await index_1.prisma.user.create({
                data: {
                    firebaseUid: decodedToken.uid,
                    email: decodedToken.email || '',
                    displayName: decodedToken.name || null,
                    photoURL: decodedToken.picture || null,
                    emailVerified: decodedToken.email_verified || false,
                    lastLoginAt: new Date(),
                },
            });
        }
        else {
            await index_1.prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
            });
        }
        if (!user) {
            user = await index_1.prisma.user.findUnique({
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
    }
    catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({
            error: 'Invalid authentication token',
            details: process.env.NODE_ENV === 'development' ? error : undefined,
        });
    }
};
exports.authenticateFirebaseToken = authenticateFirebaseToken;
const authenticateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            res.status(401).json({ error: 'API key required' });
            return;
        }
        const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
        const apiKeys = await index_1.prisma.apiKey.findMany({
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
        if (matchedApiKey.expiresAt && matchedApiKey.expiresAt < new Date()) {
            res.status(401).json({ error: 'API key has expired' });
            return;
        }
        await index_1.prisma.apiKey.update({
            where: { id: matchedApiKey.id },
            data: {
                lastUsedAt: new Date(),
                totalRequests: { increment: 1 },
            },
        });
        req.user = matchedApiKey.user;
        next();
    }
    catch (error) {
        console.error('API key authentication error:', error);
        res.status(401).json({ error: 'Invalid API key' });
    }
};
exports.authenticateApiKey = authenticateApiKey;
const requireRole = (roles) => {
    return (req, res, next) => {
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
exports.requireRole = requireRole;
const requireSubscription = (minTier) => {
    const tierOrder = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
    return (req, res, next) => {
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
exports.requireSubscription = requireSubscription;
const userRateLimit = (maxRequests, windowMs) => {
    const userRequestCounts = new Map();
    return (req, res, next) => {
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
exports.userRateLimit = userRateLimit;
//# sourceMappingURL=auth.js.map