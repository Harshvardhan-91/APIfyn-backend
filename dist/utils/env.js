"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseUrl = getDatabaseUrl;
exports.getEnvironmentConfig = getEnvironmentConfig;
function getDatabaseUrl() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
    }
    if (dbUrl.includes('sslmode=require') || dbUrl.includes('ssl=true')) {
        return dbUrl;
    }
    const separator = dbUrl.includes('?') ? '&' : '?';
    return `${dbUrl}${separator}sslmode=require&ssl=true`;
}
function getEnvironmentConfig() {
    return {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || 5000,
        DATABASE_URL: getDatabaseUrl(),
    };
}
//# sourceMappingURL=env.js.map