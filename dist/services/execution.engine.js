"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionEngine = void 0;
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const integration_service_1 = require("./integration.service");
const logger = (0, logger_1.createLogger)();
class ExecutionEngine {
    static async processStep(step, data, userId, executionId) {
        logger.info('Processing step', { stepId: step.id, type: step.blockType });
        try {
            switch (step.blockType) {
                case 'webhook-trigger':
                    return await this.processWebhookTrigger(step, data);
                case 'gmail-trigger':
                    return await this.processGmailTrigger(step, data, userId);
                case 'typeform-trigger':
                    return await this.processTypeformTrigger(step, data);
                case 'gmail-send':
                    return await this.processGmailSend(step, data, userId);
                case 'slack-send':
                    return await this.processSlackSend(step, data, userId);
                case 'sheets-add-row':
                    return await this.processGoogleSheetsAddRow(step, data, userId);
                case 'webhook-post':
                    return await this.processWebhookPost(step, data);
                case 'ai-sentiment':
                    return await this.processAISentiment(step, data);
                case 'ai-keywords':
                    return await this.processAIKeywords(step, data);
                case 'delay':
                    return await this.processDelay(step, data);
                case 'formatter':
                    return await this.processFormatter(step, data);
                case 'if-condition':
                    return await this.processCondition(step, data);
                case 'logger':
                    return await this.processLogger(step, data, executionId);
                default:
                    throw new Error(`Unknown step type: ${step.blockType}`);
            }
        }
        catch (error) {
            logger.error('Step processing failed', { stepId: step.id, error });
            throw error;
        }
    }
    static async processWebhookTrigger(step, data) {
        return data;
    }
    static async processGmailTrigger(step, data, userId) {
        const integration = await this.getIntegration(userId, 'GMAIL');
        if (!integration)
            throw new Error('Gmail integration not found');
        return { trigger: 'gmail', emails: data.emails || [] };
    }
    static async processTypeformTrigger(step, data) {
        return { trigger: 'typeform', submission: data };
    }
    static async processGmailSend(step, data, userId) {
        const integration = await this.getIntegration(userId, 'GMAIL');
        if (!integration)
            throw new Error('Gmail integration not found');
        const { to, subject, body } = step.config;
        const processedTo = this.replaceVariables(to, data);
        const processedSubject = this.replaceVariables(subject, data);
        const processedBody = this.replaceVariables(body, data);
        const result = await integration_service_1.IntegrationService.sendGmail(integration.accessToken, processedTo, processedSubject, processedBody);
        return { action: 'gmail_sent', result, to: processedTo };
    }
    static async processSlackSend(step, data, userId) {
        const integration = await this.getIntegration(userId, 'SLACK');
        if (!integration)
            throw new Error('Slack integration not found');
        const { channel, message } = step.config;
        const processedMessage = this.replaceVariables(message, data);
        const result = await integration_service_1.IntegrationService.sendSlackMessage(integration.accessToken, channel, processedMessage);
        return { action: 'slack_sent', result, channel, message: processedMessage };
    }
    static async processGoogleSheetsAddRow(step, data, userId) {
        const integration = await this.getIntegration(userId, 'GOOGLE_SHEETS');
        if (!integration)
            throw new Error('Google Sheets integration not found');
        const { spreadsheetId, range, values } = step.config;
        const processedValues = values.map((value) => this.replaceVariables(value, data));
        const result = await integration_service_1.IntegrationService.addGoogleSheetsRow(integration.accessToken, spreadsheetId, range, processedValues);
        return { action: 'sheets_row_added', result, values: processedValues };
    }
    static async processWebhookPost(step, data) {
        const { url, method = 'POST', headers = {}, body } = step.config;
        const processedBody = typeof body === 'string' ?
            this.replaceVariables(body, data) :
            this.replaceObjectVariables(body, data);
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify(processedBody)
        });
        const result = await response.json();
        return { action: 'webhook_posted', result, url };
    }
    static async processAISentiment(step, data) {
        const { textField } = step.config;
        const text = data[textField] || data.text || '';
        const result = await this.callHuggingFaceAPI('https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest', { inputs: text });
        const sentiment = result[0]?.label?.toLowerCase() || 'neutral';
        const confidence = result[0]?.score || 0;
        return {
            ...data,
            sentiment: {
                label: sentiment,
                confidence,
                original_text: text
            }
        };
    }
    static async processAIKeywords(step, data) {
        const { textField } = step.config;
        const text = data[textField] || data.text || '';
        const keywords = this.extractKeywords(text);
        return {
            ...data,
            keywords: {
                extracted: keywords,
                original_text: text
            }
        };
    }
    static async processDelay(step, data) {
        const { duration = 1000 } = step.config;
        await new Promise(resolve => setTimeout(resolve, duration));
        return data;
    }
    static async processFormatter(step, data) {
        const { format, template } = step.config;
        if (format === 'template') {
            const formatted = this.replaceVariables(template, data);
            return { ...data, formatted };
        }
        return data;
    }
    static async processCondition(step, data) {
        const { field, operator, value } = step.config;
        const fieldValue = data[field];
        let condition = false;
        switch (operator) {
            case 'equals':
                condition = fieldValue === value;
                break;
            case 'contains':
                condition = String(fieldValue).includes(value);
                break;
            case 'greater_than':
                condition = Number(fieldValue) > Number(value);
                break;
            case 'less_than':
                condition = Number(fieldValue) < Number(value);
                break;
        }
        return { ...data, condition_result: condition };
    }
    static async processLogger(step, data, executionId) {
        const { message } = step.config;
        const logMessage = this.replaceVariables(message, data);
        logger.info('Workflow logger step', {
            executionId,
            stepId: step.id,
            message: logMessage,
            data
        });
        return { ...data, logged: logMessage };
    }
    static async executeWorkflow(workflowId, triggerData = {}, executionMode = 'NORMAL') {
        const workflow = await index_1.prisma.workflow.findUnique({
            where: { id: workflowId },
            include: { user: true }
        });
        if (!workflow) {
            throw new Error('Workflow not found');
        }
        const definition = workflow.definition;
        if (!definition || !definition.steps) {
            throw new Error('Invalid workflow definition');
        }
        const execution = await index_1.prisma.workflowExecution.create({
            data: {
                workflowId,
                userId: workflow.userId,
                status: 'RUNNING',
                inputData: triggerData,
                executionMode,
                triggerSource: 'MANUAL'
            }
        });
        try {
            let currentData = triggerData;
            const executedSteps = [];
            const triggerStep = definition.steps.find(step => step.type === 'trigger');
            if (!triggerStep) {
                throw new Error('No trigger step found in workflow');
            }
            const stepQueue = [triggerStep.id];
            const visitedSteps = new Set();
            while (stepQueue.length > 0) {
                const currentStepId = stepQueue.shift();
                if (visitedSteps.has(currentStepId))
                    continue;
                visitedSteps.add(currentStepId);
                const step = definition.steps.find(s => s.id === currentStepId);
                if (!step)
                    continue;
                const stepResult = await this.processStep(step, currentData, workflow.userId, execution.id);
                executedSteps.push({
                    stepId: step.id,
                    type: step.blockType,
                    input: currentData,
                    output: stepResult,
                    timestamp: new Date()
                });
                currentData = { ...currentData, ...stepResult };
                const connections = definition.connections.filter(conn => conn.from === currentStepId);
                for (const connection of connections) {
                    if (this.shouldFollowConnection(connection, currentData)) {
                        stepQueue.push(connection.to);
                    }
                }
            }
            await index_1.prisma.workflowExecution.update({
                where: { id: execution.id },
                data: {
                    status: 'SUCCESS',
                    completedAt: new Date(),
                    outputData: currentData,
                    stepsExecuted: executedSteps,
                    totalSteps: executedSteps.length
                }
            });
            await index_1.prisma.workflow.update({
                where: { id: workflowId },
                data: {
                    totalRuns: { increment: 1 },
                    successfulRuns: { increment: 1 },
                    lastExecutedAt: new Date()
                }
            });
            return {
                executionId: execution.id,
                success: true,
                output: currentData,
                stepsExecuted: executedSteps.length
            };
        }
        catch (error) {
            await index_1.prisma.workflowExecution.update({
                where: { id: execution.id },
                data: {
                    status: 'FAILED',
                    completedAt: new Date(),
                    errorMessage: error.message
                }
            });
            await index_1.prisma.workflow.update({
                where: { id: workflowId },
                data: {
                    totalRuns: { increment: 1 },
                    failedRuns: { increment: 1 },
                    lastExecutedAt: new Date()
                }
            });
            throw error;
        }
    }
    static async getIntegration(userId, type) {
        return await index_1.prisma.integration.findFirst({
            where: {
                userId,
                type: type,
                isActive: true
            }
        });
    }
    static replaceVariables(template, data) {
        return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const keys = key.trim().split('.');
            let value = data;
            for (const k of keys) {
                value = value?.[k];
            }
            return value !== undefined ? String(value) : match;
        });
    }
    static replaceObjectVariables(obj, data) {
        if (typeof obj === 'string') {
            return this.replaceVariables(obj, data);
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.replaceObjectVariables(item, data));
        }
        if (obj && typeof obj === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.replaceObjectVariables(value, data);
            }
            return result;
        }
        return obj;
    }
    static shouldFollowConnection(connection, data) {
        if (!connection.condition)
            return true;
        const { field, operator, value } = connection.condition;
        const fieldValue = data[field];
        switch (operator) {
            case 'equals':
                return fieldValue === value;
            case 'not_equals':
                return fieldValue !== value;
            case 'true':
                return Boolean(fieldValue);
            case 'false':
                return !Boolean(fieldValue);
            default:
                return true;
        }
    }
    static async callHuggingFaceAPI(url, payload) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`Hugging Face API error: ${response.statusText}`);
        }
        return await response.json();
    }
    static extractKeywords(text) {
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3);
        const stopWords = ['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said'];
        const keywords = words.filter(word => !stopWords.includes(word));
        return [...new Set(keywords)].slice(0, 10);
    }
}
exports.ExecutionEngine = ExecutionEngine;
//# sourceMappingURL=execution.engine.js.map