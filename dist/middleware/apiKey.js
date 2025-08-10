"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyMiddleware = apiKeyMiddleware;
const index_1 = require("../index");
async function apiKeyMiddleware(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        res.status(401).json({ error: 'API key required' });
        return;
    }
    const key = await index_1.prisma.apiKey.findUnique({
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
//# sourceMappingURL=apiKey.js.map