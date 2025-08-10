import { prisma } from '../index';
import { createLogger } from '../utils/logger';
import { IntegrationService } from './integration.service';
import { WorkflowService } from './workflow.service';

const logger = createLogger();

export interface WorkflowStep {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'utility';
  blockType: string;
  config: any;
  position: { x: number; y: number };
  connections?: string[];
}

export interface WorkflowDefinition {
  steps: WorkflowStep[];
  connections: Array<{
    from: string;
    to: string;
    condition?: any;
  }>;
}

export class ExecutionEngine {
  private static async processStep(
    step: WorkflowStep,
    data: any,
    userId: string,
    executionId: string
  ): Promise<any> {
    logger.info('Processing step', { stepId: step.id, type: step.blockType });

    try {
      switch (step.blockType) {
        // Trigger blocks
        case 'webhook-trigger':
          return await this.processWebhookTrigger(step, data);
        
        case 'gmail-trigger':
          return await this.processGmailTrigger(step, data, userId);
        
        case 'typeform-trigger':
          return await this.processTypeformTrigger(step, data);

        // Action blocks
        case 'gmail-send':
          return await this.processGmailSend(step, data, userId);
        
        case 'slack-send':
          return await this.processSlackSend(step, data, userId);
        
        case 'sheets-add-row':
          return await this.processGoogleSheetsAddRow(step, data, userId);
        
        case 'webhook-post':
          return await this.processWebhookPost(step, data);

        // AI blocks
        case 'ai-sentiment':
          return await this.processAISentiment(step, data);
        
        case 'ai-keywords':
          return await this.processAIKeywords(step, data);

        // Utility blocks
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
    } catch (error) {
      logger.error('Step processing failed', { stepId: step.id, error });
      throw error;
    }
  }

  // Trigger Processors
  private static async processWebhookTrigger(step: WorkflowStep, data: any): Promise<any> {
    // Webhook triggers are processed when webhook is received
    return data;
  }

  private static async processGmailTrigger(step: WorkflowStep, data: any, userId: string): Promise<any> {
    // Gmail trigger would poll for new emails
    const integration = await this.getIntegration(userId, 'GMAIL');
    if (!integration) throw new Error('Gmail integration not found');
    
    // TODO: Implement Gmail polling logic
    return { trigger: 'gmail', emails: data.emails || [] };
  }

  private static async processTypeformTrigger(step: WorkflowStep, data: any): Promise<any> {
    // Typeform triggers come via webhook
    return { trigger: 'typeform', submission: data };
  }

  // Action Processors
  private static async processGmailSend(step: WorkflowStep, data: any, userId: string): Promise<any> {
    const integration = await this.getIntegration(userId, 'GMAIL');
    if (!integration) throw new Error('Gmail integration not found');

    const { to, subject, body } = step.config;
    
    // Replace variables in the email content
    const processedTo = this.replaceVariables(to, data);
    const processedSubject = this.replaceVariables(subject, data);
    const processedBody = this.replaceVariables(body, data);

    const result = await IntegrationService.sendGmail(
      integration.accessToken!,
      processedTo,
      processedSubject,
      processedBody
    );

    return { action: 'gmail_sent', result, to: processedTo };
  }

  private static async processSlackSend(step: WorkflowStep, data: any, userId: string): Promise<any> {
    const integration = await this.getIntegration(userId, 'SLACK');
    if (!integration) throw new Error('Slack integration not found');

    const { channel, message } = step.config;
    const processedMessage = this.replaceVariables(message, data);

    const result = await IntegrationService.sendSlackMessage(
      integration.accessToken!,
      channel,
      processedMessage
    );

    return { action: 'slack_sent', result, channel, message: processedMessage };
  }

  private static async processGoogleSheetsAddRow(step: WorkflowStep, data: any, userId: string): Promise<any> {
    const integration = await this.getIntegration(userId, 'GOOGLE_SHEETS');
    if (!integration) throw new Error('Google Sheets integration not found');

    const { spreadsheetId, range, values } = step.config;
    
    // Process values by replacing variables
    const processedValues = values.map((value: string) => this.replaceVariables(value, data));

    const result = await IntegrationService.addGoogleSheetsRow(
      integration.accessToken!,
      spreadsheetId,
      range,
      processedValues
    );

    return { action: 'sheets_row_added', result, values: processedValues };
  }

  private static async processWebhookPost(step: WorkflowStep, data: any): Promise<any> {
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

  // AI Processors
  private static async processAISentiment(step: WorkflowStep, data: any): Promise<any> {
    const { textField } = step.config;
    const text = data[textField] || data.text || '';

    // Use Hugging Face Sentiment Analysis
    const result = await this.callHuggingFaceAPI(
      'https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest',
      { inputs: text }
    );

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

  private static async processAIKeywords(step: WorkflowStep, data: any): Promise<any> {
    const { textField } = step.config;
    const text = data[textField] || data.text || '';

    // Use a simple keyword extraction (can be enhanced with proper NLP)
    const keywords = this.extractKeywords(text);

    return { 
      ...data, 
      keywords: {
        extracted: keywords,
        original_text: text
      }
    };
  }

  // Utility Processors
  private static async processDelay(step: WorkflowStep, data: any): Promise<any> {
    const { duration = 1000 } = step.config; // milliseconds
    await new Promise(resolve => setTimeout(resolve, duration));
    return data;
  }

  private static async processFormatter(step: WorkflowStep, data: any): Promise<any> {
    const { format, template } = step.config;
    
    if (format === 'template') {
      const formatted = this.replaceVariables(template, data);
      return { ...data, formatted };
    }
    
    // Add more formatting options as needed
    return data;
  }

  private static async processCondition(step: WorkflowStep, data: any): Promise<any> {
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

  private static async processLogger(step: WorkflowStep, data: any, executionId: string): Promise<any> {
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

  // Main execution method
  static async executeWorkflow(
    workflowId: string, 
    triggerData: any = {},
    executionMode: 'NORMAL' | 'TEST' = 'NORMAL'
  ): Promise<any> {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { user: true }
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const definition = workflow.definition as WorkflowDefinition;
    if (!definition || !definition.steps) {
      throw new Error('Invalid workflow definition');
    }

    // Create execution record
    const execution = await prisma.workflowExecution.create({
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
      const executedSteps: any[] = [];

      // Find the starting step (trigger)
      const triggerStep = definition.steps.find(step => step.type === 'trigger');
      if (!triggerStep) {
        throw new Error('No trigger step found in workflow');
      }

      // Execute workflow steps in order
      const stepQueue = [triggerStep.id];
      const visitedSteps = new Set<string>();

      while (stepQueue.length > 0) {
        const currentStepId = stepQueue.shift()!;
        
        if (visitedSteps.has(currentStepId)) continue;
        visitedSteps.add(currentStepId);

        const step = definition.steps.find(s => s.id === currentStepId);
        if (!step) continue;

        // Process the step
        const stepResult = await this.processStep(step, currentData, workflow.userId, execution.id);
        
        executedSteps.push({
          stepId: step.id,
          type: step.blockType,
          input: currentData,
          output: stepResult,
          timestamp: new Date()
        });

        // Update current data with step result
        currentData = { ...currentData, ...stepResult };

        // Find next steps based on connections
        const connections = definition.connections.filter(conn => conn.from === currentStepId);
        for (const connection of connections) {
          // Check if we should follow this connection based on conditions
          if (this.shouldFollowConnection(connection, currentData)) {
            stepQueue.push(connection.to);
          }
        }
      }

      // Update execution as successful
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          outputData: currentData,
          stepsExecuted: executedSteps,
          totalSteps: executedSteps.length
        }
      });

      // Update workflow stats
      await prisma.workflow.update({
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

    } catch (error: any) {
      // Update execution as failed
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error.message
        }
      });

      // Update workflow stats
      await prisma.workflow.update({
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

  // Helper methods
  private static async getIntegration(userId: string, type: string) {
    return await prisma.integration.findFirst({
      where: { 
        userId, 
        type: type as any,
        isActive: true 
      }
    });
  }

  private static replaceVariables(template: string, data: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const keys = key.trim().split('.');
      let value = data;
      
      for (const k of keys) {
        value = value?.[k];
      }
      
      return value !== undefined ? String(value) : match;
    });
  }

  private static replaceObjectVariables(obj: any, data: any): any {
    if (typeof obj === 'string') {
      return this.replaceVariables(obj, data);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceObjectVariables(item, data));
    }
    
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceObjectVariables(value, data);
      }
      return result;
    }
    
    return obj;
  }

  private static shouldFollowConnection(connection: any, data: any): boolean {
    if (!connection.condition) return true;
    
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

  private static async callHuggingFaceAPI(url: string, payload: any): Promise<any> {
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

  private static extractKeywords(text: string): string[] {
    // Simple keyword extraction - can be enhanced with proper NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Remove common stop words
    const stopWords = ['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said'];
    const keywords = words.filter(word => !stopWords.includes(word));
    
    // Get unique keywords
    return [...new Set(keywords)].slice(0, 10);
  }
}
