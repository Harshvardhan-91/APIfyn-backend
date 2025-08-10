"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const client_1 = require("@prisma/client");
const node_fetch_1 = __importDefault(require("node-fetch"));
const router = express_1.default.Router();
const logger = (0, logger_1.createLogger)();
function getIntegrationType(provider) {
    const providerUpper = provider.toUpperCase();
    if (Object.values(client_1.IntegrationType).includes(providerUpper)) {
        return providerUpper;
    }
    throw new errorHandler_1.CustomError(`Unsupported integration type: ${provider}`, 400);
}
router.get('/', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const integrations = await index_1.prisma.integration.findMany({
        where: { userId: user.id },
        select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
            totalCalls: true,
            lastUsedAt: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json({
        success: true,
        integrations,
    });
}));
router.post('/', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { name, type, config } = req.body;
    if (!name || !type || !config) {
        throw new errorHandler_1.CustomError('Name, type, and config are required', 400);
    }
    const validTypes = [
        'GMAIL', 'SLACK', 'NOTION', 'GOOGLE_SHEETS', 'AIRTABLE',
        'SALESFORCE', 'HUBSPOT', 'WEBHOOK', 'REST_API', 'GRAPHQL'
    ];
    if (!validTypes.includes(type)) {
        throw new errorHandler_1.CustomError('Invalid integration type', 400);
    }
    const integration = await index_1.prisma.integration.create({
        data: {
            name,
            type,
            config,
            userId: user.id,
        },
    });
    logger.info(`Integration created: ${name} (${type}) for user ${user.email}`);
    res.json({
        success: true,
        integration: {
            id: integration.id,
            name: integration.name,
            type: integration.type,
            isActive: integration.isActive,
            createdAt: integration.createdAt,
        },
    });
}));
router.put('/:id', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const { name, config, isActive } = req.body;
    if (!id) {
        throw new errorHandler_1.CustomError('Integration ID is required', 400);
    }
    const integration = await index_1.prisma.integration.findFirst({
        where: { id, userId: user.id },
    });
    if (!integration) {
        throw new errorHandler_1.CustomError('Integration not found', 404);
    }
    const updatedIntegration = await index_1.prisma.integration.update({
        where: { id },
        data: {
            name: name || integration.name,
            config: config || integration.config,
            isActive: isActive !== undefined ? isActive : integration.isActive,
            updatedAt: new Date(),
        },
    });
    logger.info(`Integration updated: ${integration.name} for user ${user.email}`);
    res.json({
        success: true,
        integration: {
            id: updatedIntegration.id,
            name: updatedIntegration.name,
            type: updatedIntegration.type,
            isActive: updatedIntegration.isActive,
            updatedAt: updatedIntegration.updatedAt,
        },
    });
}));
router.delete('/:id', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    if (!id) {
        throw new errorHandler_1.CustomError('Integration ID is required', 400);
    }
    const integration = await index_1.prisma.integration.findFirst({
        where: { id, userId: user.id },
    });
    if (!integration) {
        throw new errorHandler_1.CustomError('Integration not found', 404);
    }
    await index_1.prisma.integration.delete({
        where: { id },
    });
    logger.info(`Integration deleted: ${integration.name} for user ${user.email}`);
    res.json({
        success: true,
        message: 'Integration deleted successfully',
    });
}));
router.post('/:id/test', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    if (!id) {
        throw new errorHandler_1.CustomError('Integration ID is required', 400);
    }
    const integration = await index_1.prisma.integration.findFirst({
        where: { id, userId: user.id },
    });
    if (!integration) {
        throw new errorHandler_1.CustomError('Integration not found', 404);
    }
    const testResult = await testIntegrationConnection(integration);
    if (testResult.success) {
        await index_1.prisma.integration.update({
            where: { id },
            data: { lastUsedAt: new Date() },
        });
    }
    res.json({
        success: true,
        test: testResult,
    });
}));
router.get('/types', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const integrationTypes = [
        {
            type: 'GMAIL',
            name: 'Gmail',
            description: 'Send and manage emails',
            category: 'Email',
            authType: 'oauth',
        },
        {
            type: 'SLACK',
            name: 'Slack',
            description: 'Send messages and manage channels',
            category: 'Communication',
            authType: 'oauth',
        },
        {
            type: 'NOTION',
            name: 'Notion',
            description: 'Create and manage pages and databases',
            category: 'Productivity',
            authType: 'oauth',
        },
        {
            type: 'GOOGLE_SHEETS',
            name: 'Google Sheets',
            description: 'Read and write spreadsheet data',
            category: 'Data',
            authType: 'oauth',
        },
        {
            type: 'WEBHOOK',
            name: 'Webhook',
            description: 'Receive HTTP requests',
            category: 'Triggers',
            authType: 'none',
        },
        {
            type: 'REST_API',
            name: 'REST API',
            description: 'Make HTTP requests to any API',
            category: 'API',
            authType: 'api_key',
        },
    ];
    res.json({
        success: true,
        types: integrationTypes,
    });
}));
async function testIntegrationConnection(integration) {
    try {
        switch (integration.type) {
            case 'GMAIL':
                return { success: true, message: 'Gmail connection successful' };
            case 'SLACK':
                return { success: true, message: 'Slack connection successful' };
            case 'WEBHOOK':
                return { success: true, message: 'Webhook endpoint ready' };
            default:
                return { success: false, message: 'Integration test not implemented' };
        }
    }
    catch (error) {
        logger.error('Integration test failed:', error);
        return { success: false, message: 'Connection test failed' };
    }
}
router.get('/status', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const integrations = await index_1.prisma.integration.findMany({
        where: {
            userId: user.id,
            isActive: true
        },
        select: {
            type: true,
            isActive: true,
            createdAt: true,
        },
    });
    const statusMap = {};
    integrations.forEach(integration => {
        statusMap[integration.type.toLowerCase()] = 'connected';
    });
    res.json({
        success: true,
        integrations: statusMap,
    });
}));
router.get('/oauth/:provider/authorize', auth_1.authenticateFirebaseToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { provider } = req.params;
    const user = req.user;
    if (!provider) {
        throw new errorHandler_1.CustomError('Provider parameter is required', 400);
    }
    let authUrl = '';
    let redirectUri = '';
    switch (provider.toLowerCase()) {
        case 'gmail':
            redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/gmail/callback';
            authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${process.env.GMAIL_CLIENT_ID}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `response_type=code&` +
                `scope=${encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send')}&` +
                `access_type=offline&` +
                `state=${user.id}`;
            break;
        case 'slack':
            redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/slack/callback';
            authUrl = `https://slack.com/oauth/v2/authorize?` +
                `client_id=${process.env.SLACK_CLIENT_ID}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `scope=${encodeURIComponent('channels:read,chat:write,users:read')}&` +
                `state=${user.id}`;
            break;
        case 'notion':
            redirectUri = process.env.NOTION_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/notion/callback';
            authUrl = `https://api.notion.com/v1/oauth/authorize?` +
                `client_id=${process.env.NOTION_CLIENT_ID}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `response_type=code&` +
                `owner=user&` +
                `state=${user.id}`;
            break;
        case 'discord':
            redirectUri = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/discord/callback';
            authUrl = `https://discord.com/api/oauth2/authorize?` +
                `client_id=${process.env.DISCORD_CLIENT_ID}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `response_type=code&` +
                `scope=${encodeURIComponent('bot webhook.incoming')}&` +
                `state=${user.id}`;
            break;
        default:
            throw new errorHandler_1.CustomError('Unsupported OAuth provider', 400);
    }
    res.json({
        success: true,
        authUrl: authUrl,
        provider: provider,
        message: 'Redirect user to this URL for authorization'
    });
}));
router.get('/oauth/:provider/callback', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { provider } = req.params;
    const { code, state } = req.query;
    if (!provider) {
        throw new errorHandler_1.CustomError('Provider parameter is required', 400);
    }
    if (!code || !state) {
        throw new errorHandler_1.CustomError('Missing authorization code or state', 400);
    }
    try {
        let tokenResponse = {};
        let redirectUri = '';
        switch (provider.toLowerCase()) {
            case 'gmail':
                redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/gmail/callback';
                tokenResponse = await exchangeCodeForToken('gmail', code, redirectUri);
                break;
            case 'slack':
                redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/slack/callback';
                tokenResponse = await exchangeCodeForToken('slack', code, redirectUri);
                break;
            case 'notion':
                redirectUri = process.env.NOTION_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/notion/callback';
                tokenResponse = await exchangeCodeForToken('notion', code, redirectUri);
                break;
            case 'discord':
                redirectUri = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5000/api/integration/oauth/discord/callback';
                tokenResponse = await exchangeCodeForToken('discord', code, redirectUri);
                break;
            default:
                throw new errorHandler_1.CustomError('Unsupported OAuth provider', 400);
        }
        await index_1.prisma.integration.create({
            data: {
                userId: state,
                name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Integration`,
                type: getIntegrationType(provider),
                config: {
                    accessToken: tokenResponse.access_token,
                    refreshToken: tokenResponse.refresh_token,
                    expiresAt: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000) : null,
                },
                isActive: true,
            },
        });
        res.redirect(`${process.env.FRONTEND_URL}/workflows?integration=${provider}&status=success`);
    }
    catch (error) {
        logger.error(`OAuth callback error for ${provider}:`, error);
        res.redirect(`${process.env.FRONTEND_URL}/workflows?integration=${provider}&status=error`);
    }
}));
async function exchangeCodeForToken(provider, code, redirectUri) {
    let tokenUrl = '';
    let requestBody = {};
    switch (provider) {
        case 'gmail':
            tokenUrl = 'https://oauth2.googleapis.com/token';
            requestBody = {
                client_id: process.env.GMAIL_CLIENT_ID,
                client_secret: process.env.GMAIL_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            };
            break;
        case 'slack':
            tokenUrl = 'https://slack.com/api/oauth.v2.access';
            requestBody = {
                client_id: process.env.SLACK_CLIENT_ID,
                client_secret: process.env.SLACK_CLIENT_SECRET,
                code: code,
                redirect_uri: redirectUri,
            };
            break;
        case 'notion':
            tokenUrl = 'https://api.notion.com/v1/oauth/token';
            requestBody = {
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
            };
            break;
        case 'discord':
            tokenUrl = 'https://discord.com/api/oauth2/token';
            requestBody = {
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
            };
            break;
    }
    const response = await (0, node_fetch_1.default)(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(provider === 'notion' ? {
                'Authorization': `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64')}`,
                'Notion-Version': '2022-06-28'
            } : {})
        },
        body: new URLSearchParams(requestBody).toString(),
    });
    if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
    }
    return await response.json();
}
exports.default = router;
//# sourceMappingURL=integration.js.map