"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationService = void 0;
const index_1 = require("../index");
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)();
class IntegrationService {
    static async connectIntegration(data) {
        const integrationType = client_1.IntegrationType[data.type.toUpperCase()];
        if (!integrationType)
            throw new Error('Invalid integration type');
        return index_1.prisma.integration.create({
            data: {
                ...data,
                type: integrationType,
            },
        });
    }
    static async getUserIntegrations(userId) {
        return index_1.prisma.integration.findMany({ where: { userId } });
    }
    static async removeIntegration(id) {
        return index_1.prisma.integration.delete({ where: { id } });
    }
    static async sendGmail(accessToken, to, subject, body) {
        try {
            const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    raw: this.createEmailRaw(to, subject, body)
                })
            });
            if (!response.ok) {
                throw new Error(`Gmail API error: ${response.statusText}`);
            }
            const result = await response.json();
            logger.info('Email sent successfully', { messageId: result.id });
            return result;
        }
        catch (error) {
            logger.error('Error sending Gmail:', error);
            throw error;
        }
    }
    static async sendSlackMessage(accessToken, channel, text) {
        try {
            const response = await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    channel,
                    text
                })
            });
            if (!response.ok) {
                throw new Error(`Slack API error: ${response.statusText}`);
            }
            const result = await response.json();
            if (!result.ok) {
                throw new Error(`Slack error: ${result.error}`);
            }
            logger.info('Slack message sent successfully', { channel, timestamp: result.ts });
            return result;
        }
        catch (error) {
            logger.error('Error sending Slack message:', error);
            throw error;
        }
    }
    static async addGoogleSheetsRow(accessToken, spreadsheetId, range, values) {
        return this.addRowToSheet(accessToken, spreadsheetId, range, [values]);
    }
    static async addRowToSheet(accessToken, spreadsheetId, range, values) {
        try {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values
                })
            });
            if (!response.ok) {
                throw new Error(`Google Sheets API error: ${response.statusText}`);
            }
            const result = await response.json();
            logger.info('Row added to Google Sheets', { spreadsheetId, range });
            return result;
        }
        catch (error) {
            logger.error('Error adding row to Google Sheets:', error);
            throw error;
        }
    }
    static async callOpenAI(prompt, model = 'gpt-3.5-turbo') {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 150,
                    temperature: 0.7
                })
            });
            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.statusText}`);
            }
            const result = await response.json();
            logger.info('OpenAI API call successful');
            return result.choices[0]?.message?.content || '';
        }
        catch (error) {
            logger.error('Error calling OpenAI:', error);
            throw error;
        }
    }
    static async analyzeSentiment(text) {
        try {
            const response = await fetch('https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inputs: text })
            });
            if (!response.ok) {
                throw new Error(`Hugging Face API error: ${response.statusText}`);
            }
            const result = await response.json();
            logger.info('Sentiment analysis completed');
            const sentiment = result[0]?.reduce((prev, current) => prev.score > current.score ? prev : current);
            return {
                sentiment: sentiment?.label || 'NEUTRAL',
                confidence: sentiment?.score || 0,
                raw: result
            };
        }
        catch (error) {
            logger.error('Error analyzing sentiment:', error);
            throw error;
        }
    }
    static async makeHttpRequest(url, method = 'GET', headers = {}, body = null) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };
            if (body && method !== 'GET') {
                options.body = typeof body === 'string' ? body : JSON.stringify(body);
            }
            const response = await fetch(url, options);
            const contentType = response.headers.get('content-type');
            let result;
            if (contentType?.includes('application/json')) {
                result = await response.json();
            }
            else {
                result = await response.text();
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            logger.info('HTTP request completed', { url, method, status: response.status });
            return {
                status: response.status,
                statusText: response.statusText,
                data: result,
                headers: Object.fromEntries(response.headers.entries())
            };
        }
        catch (error) {
            logger.error('Error making HTTP request:', error);
            throw error;
        }
    }
    static createEmailRaw(to, subject, body) {
        const email = [
            `To: ${to}`,
            `Subject: ${subject}`,
            '',
            body
        ].join('\n');
        return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    }
}
exports.IntegrationService = IntegrationService;
//# sourceMappingURL=integration.service.js.map