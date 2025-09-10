import { prisma } from '../db';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface WebhookPayload {
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
  };
  pusher: {
    name: string;
    email: string;
  };
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    url: string;
  }>;
  ref: string;
  before: string;
  after: string;
  compare: string;
  action?: string; // For pull request events (opened, closed, etc.)
  pull_request?: {
    title: string;
    body: string;
    user: {
      login: string;
      avatar_url: string;
    };
    html_url: string;
    number: number;
  };
}

export class WebhookService {
  // Create GitHub webhook for a repository
  static async createGitHubWebhook(accessToken: string, repoFullName: string, workflowId: string): Promise<any> {
    const webhookUrl = `${process.env.FRONTEND_URL}/api/webhooks/github/${workflowId}`;
    
    const webhookResponse = await fetch(`https://api.github.com/repos/${repoFullName}/hooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push', 'pull_request'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          insecure_ssl: '0'
        }
      }),
    });

    if (!webhookResponse.ok) {
      const error = await webhookResponse.json() as { message?: string };
      throw new Error(`Failed to create webhook: ${error.message || 'Unknown error'}`);
    }

    return await webhookResponse.json();
  }

  // Delete GitHub webhook
  static async deleteGitHubWebhook(accessToken: string, repoFullName: string, webhookId: number): Promise<void> {
    const webhookResponse = await fetch(`https://api.github.com/repos/${repoFullName}/hooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!webhookResponse.ok) {
      throw new Error('Failed to delete webhook');
    }
  }

  // Process GitHub webhook payload
  static async processGitHubWebhook(workflowId: string, payload: WebhookPayload): Promise<void> {
    try {
      logger.info(`Processing GitHub webhook for workflow ${workflowId}`);

      // Get the workflow and user
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { user: true }
      });

      if (!workflow || !workflow.isActive) {
        logger.warn(`Workflow ${workflowId} not found or inactive`);
        return;
      }

      // Create execution log
      const execution = await prisma.workflowExecution.create({
        data: {
          workflowId,
          userId: workflow.userId,
          status: 'RUNNING',
          inputData: payload as any
        }
      });

      // Process the workflow (trigger Slack message)
      await this.executeWorkflowActions(execution.id, workflow, payload);

      // Update execution status
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date()
        }
      });

      logger.info(`Successfully processed webhook for workflow ${workflowId}`);
    } catch (error) {
      logger.error(`Error processing webhook for workflow ${workflowId}:`, error);
      
      // Update execution status to failed
      const execution = await prisma.workflowExecution.findFirst({
        where: { workflowId },
        orderBy: { startedAt: 'desc' }
      });

      if (execution) {
        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date()
          }
        });
      }
      
      throw error;
    }
  }

  // Execute workflow actions (e.g., send Slack message)
  private static async executeWorkflowActions(executionId: string, workflow: any, payload: WebhookPayload): Promise<void> {
    const actionConfig = workflow.actionConfig as any;

    if (actionConfig.type === 'slack-send') {
      await this.sendSlackMessage(workflow.userId, actionConfig, payload);
    }
  }

  // Send Slack message
  private static async sendSlackMessage(userId: string, actionConfig: any, payload: WebhookPayload): Promise<void> {
    // Get Slack integration
    const slackIntegration = await prisma.integration.findFirst({
      where: {
        userId,
        type: 'SLACK'
      }
    });

    if (!slackIntegration || !slackIntegration.accessToken) {
      throw new Error('Slack integration not found or not authorized');
    }

    // Build message from template
    const message = this.buildSlackMessage(actionConfig.messageTemplate || '', payload);

    // Send message to Slack
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackIntegration.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: actionConfig.channel,
        text: message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Repository: <${payload.repository.html_url}|${payload.repository.full_name}> | Commits: ${payload.commits.length}`
              }
            ]
          }
        ]
      }),
    });

    const slackData = await slackResponse.json() as { ok: boolean; error?: string };
    
    if (!slackData.ok) {
      throw new Error(`Failed to send Slack message: ${slackData.error || 'Unknown error'}`);
    }

    logger.info(`Slack message sent successfully to channel ${actionConfig.channel}`);
  }

  // Build Slack message from template with payload data
  private static buildSlackMessage(template: string, payload: WebhookPayload): string {
    if (!template) {
      // Default message template with simple variables
      template = `🚀 New push to {{repository_name}} by {{author_name}}!`;
    }

    // Simple variable replacements (user-friendly)
    let message = template
      .replace(/\{\{repository_name\}\}/g, payload.repository.name)
      .replace(/\{\{author_name\}\}/g, payload.pusher.name)
      .replace(/\{\{pull_request_title\}\}/g, payload.pull_request?.title || 'N/A')
      .replace(/\{\{action\}\}/g, payload.action || 'updated');

    // Advanced variable replacements (for backward compatibility)
    message = message
      .replace(/\{\{payload\.repository\.name\}\}/g, payload.repository.name)
      .replace(/\{\{payload\.repository\.full_name\}\}/g, payload.repository.full_name)
      .replace(/\{\{payload\.pusher\.name\}\}/g, payload.pusher.name)
      .replace(/\{\{payload\.pusher\.email\}\}/g, payload.pusher.email)
      .replace(/\{\{payload\.pull_request\.title\}\}/g, payload.pull_request?.title || 'N/A')
      .replace(/\{\{payload\.pull_request\.user\.login\}\}/g, payload.pull_request?.user?.login || 'N/A')
      .replace(/\{\{payload\.action\}\}/g, payload.action || 'updated')
      .replace(/\{\{payload\.ref\}\}/g, payload.ref?.replace('refs/heads/', '') || 'main')
      .replace(/\{\{payload\.commits\.length\}\}/g, payload.commits?.length?.toString() || '0')
      .replace(/\{\{payload\.compare\}\}/g, payload.compare || '');

    // Handle commit loop (advanced feature)
    if (template.includes('{{#each commits}}')) {
      const commitTemplate = template.match(/\{\{#each commits\}\}(.*?)\{\{\/each\}\}/s)?.[1] || '';
      const commitMessages = payload.commits?.map(commit => 
        commitTemplate
          .replace(/\{\{message\}\}/g, commit.message)
          .replace(/\{\{author\.name\}\}/g, commit.author.name)
          .replace(/\{\{author\.email\}\}/g, commit.author.email)
          .replace(/\{\{url\}\}/g, commit.url)
      ).join('') || '';
      
      message = message.replace(/\{\{#each commits\}\}.*?\{\{\/each\}\}/s, commitMessages);
    }

    return message;
  }
}
