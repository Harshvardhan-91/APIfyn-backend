"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const client_1 = require("@prisma/client");
const logger_1 = require("./utils/logger");
const env_1 = require("./utils/env");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = __importDefault(require("./routes/auth"));
const user_1 = __importDefault(require("./routes/user"));
const workflow_1 = __importDefault(require("./routes/workflow"));
const integration_1 = __importDefault(require("./routes/integration"));
const subscription_1 = __importDefault(require("./routes/subscription"));
const webhook_1 = __importDefault(require("./routes/webhook"));
dotenv_1.default.config();
const logger = (0, logger_1.createLogger)();
exports.prisma = new client_1.PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
        db: {
            url: (0, env_1.getDatabaseUrl)(),
        },
    },
});
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const initializeFirebase = async () => {
    if (!firebase_admin_1.default.apps.length) {
        try {
            const projectId = process.env.FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
            const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
            if (!projectId || !clientEmail || !privateKey) {
                throw new Error('Missing Firebase credentials in environment variables');
            }
            const serviceAccount = {
                projectId,
                clientEmail,
                privateKey,
            };
            firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.cert(serviceAccount),
                projectId,
            });
            logger.info('Firebase Admin initialized successfully');
        }
        catch (error) {
            logger.error('Firebase Admin initialization error:', error);
            if (process.env.NODE_ENV === 'production') {
                process.exit(1);
            }
        }
    }
};
const initializeDatabase = async () => {
    try {
        const dbUrl = (0, env_1.getDatabaseUrl)();
        const parsedUrl = new URL(dbUrl);
        logger.info(`Attempting to connect to database at: ${parsedUrl.hostname}:${parsedUrl.port}`);
        await exports.prisma.$connect();
        logger.info('Database connected successfully');
        await exports.prisma.$queryRaw `SELECT 1`;
        logger.info('Database connection test successful');
    }
    catch (error) {
        logger.error('Database connection error:', error);
        if (process.env.NODE_ENV === 'production') {
            logger.error('Exiting due to database connection failure in production');
            process.exit(1);
        }
        else {
            logger.warn('Continuing without database in development mode');
        }
    }
};
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
}));
const getAllowedOrigins = () => {
    const originsEnv = process.env.ALLOWED_ORIGINS;
    if (!originsEnv) {
        logger.error('ALLOWED_ORIGINS environment variable is not set');
        return [];
    }
    return originsEnv
        .split(',')
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0);
};
const allowedOrigins = getAllowedOrigins();
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        if (!origin) {
            callback(null, true);
            return;
        }
        if (process.env.NODE_ENV === 'development') {
            callback(null, true);
            return;
        }
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            logger.warn(`Blocked request from unauthorized origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use((0, compression_1.default)());
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: 15 * 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.method !== 'GET' ? req.body : undefined,
    });
    next();
});
app.use('/api/auth', auth_1.default);
app.use('/api/user', user_1.default);
app.use('/api/workflow', workflow_1.default);
app.use('/api/integration', integration_1.default);
app.use('/api/subscriptions', subscription_1.default);
app.use('/api/webhook', webhook_1.default);
app.get('/api/health', async (req, res) => {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            database: 'connected',
        });
    }
    catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: process.env.NODE_ENV === 'development' ? error : 'Database connection failed',
        });
    }
});
app.get('/api/docs', (req, res) => {
    res.json({
        name: 'FlowAPI Server',
        version: '1.0.0',
        description: 'Automation workflow platform API',
        endpoints: {
            auth: '/api/auth',
            user: '/api/user',
            workflow: '/api/workflow',
            integration: '/api/integration',
            health: '/api/health',
        },
        documentation: 'https://docs.flowapi.com',
    });
});
app.use(errorHandler_1.errorHandler);
app.use((req, res) => {
    logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
    });
});
const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    try {
        await exports.prisma.$disconnect();
        logger.info('Database disconnected');
        process.exit(0);
    }
    catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
const startServer = async () => {
    try {
        await initializeFirebase();
        await initializeDatabase();
        app.listen(PORT, () => {
            logger.info(`🚀 FlowAPI Server running on port ${PORT}`);
            logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
            logger.info(`📖 API docs: http://localhost:${PORT}/api/docs`);
        });
    }
    catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map