"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
const logger = (0, logger_1.createLogger)();
router.post('/verify', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) {
        throw new errorHandler_1.CustomError('ID token is required', 400);
    }
    try {
        const decodedToken = await firebase_admin_1.default.auth().verifyIdToken(idToken);
        let user = await index_1.prisma.user.findUnique({
            where: { firebaseUid: decodedToken.uid },
        });
        if (!user) {
            user = await index_1.prisma.user.create({
                data: {
                    firebaseUid: decodedToken.uid,
                    email: decodedToken.email || '',
                    displayName: decodedToken.name || null,
                    photoURL: decodedToken.picture || null,
                    emailVerified: decodedToken.email_verified || false,
                    lastLoginAt: new Date(),
                },
            });
            logger.info(`New user created: ${user.email}`);
        }
        else {
            user = await index_1.prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
            });
        }
        const { firebaseUid, ...userData } = user;
        res.json({
            success: true,
            user: userData,
            firebase: {
                uid: decodedToken.uid,
                email: decodedToken.email,
                emailVerified: decodedToken.email_verified,
            },
        });
    }
    catch (error) {
        logger.error('Token verification failed:', error);
        if (process.env.NODE_ENV === 'development') {
            const mockUser = {
                id: 'dev-user-id',
                email: 'dev@example.com',
                displayName: 'Development User',
                photoURL: null,
                emailVerified: true,
                role: 'USER',
                subscription: 'FREE',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            logger.warn('Development mode: Using mock user');
            res.json({
                success: true,
                user: mockUser,
                firebase: {
                    uid: 'dev-uid',
                    email: 'dev@example.com',
                    emailVerified: true,
                },
                development: true,
            });
            return;
        }
        throw new errorHandler_1.CustomError('Invalid or expired token', 401);
    }
}));
router.post('/refresh', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const firebaseUser = req.firebaseUser;
    const updatedUser = await index_1.prisma.user.update({
        where: { id: user.id },
        data: {
            displayName: firebaseUser.name || user.displayName,
            photoURL: firebaseUser.picture || user.photoURL,
            emailVerified: firebaseUser.email_verified || user.emailVerified,
            lastLoginAt: new Date(),
        },
    });
    const { firebaseUid, ...userData } = updatedUser;
    res.json({
        success: true,
        user: userData,
    });
}));
router.post('/signout', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const firebaseUser = req.firebaseUser;
    try {
        await firebase_admin_1.default.auth().revokeRefreshTokens(firebaseUser.uid);
        logger.info(`User signed out: ${req.user.email}`);
        res.json({
            success: true,
            message: 'Successfully signed out',
        });
    }
    catch (error) {
        logger.error('Sign out error:', error);
        throw new errorHandler_1.CustomError('Failed to sign out', 500);
    }
}));
router.delete('/delete-account', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const firebaseUser = req.firebaseUser;
    try {
        await index_1.prisma.user.delete({
            where: { id: user.id },
        });
        await firebase_admin_1.default.auth().deleteUser(firebaseUser.uid);
        logger.info(`User account deleted: ${user.email}`);
        res.json({
            success: true,
            message: 'Account successfully deleted',
        });
    }
    catch (error) {
        logger.error('Account deletion error:', error);
        throw new errorHandler_1.CustomError('Failed to delete account', 500);
    }
}));
router.get('/me', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const userWithStats = await index_1.prisma.user.findUnique({
        where: { id: user.id },
        include: {
            _count: {
                select: {
                    workflows: true,
                    executions: true,
                    integrations: true,
                },
            },
        },
    });
    if (!userWithStats) {
        throw new errorHandler_1.CustomError('User not found', 404);
    }
    const { firebaseUid, ...userData } = userWithStats;
    res.json({
        success: true,
        user: userData,
    });
}));
exports.default = router;
//# sourceMappingURL=auth.js.map