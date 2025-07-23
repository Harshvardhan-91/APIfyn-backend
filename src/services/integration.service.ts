import { prisma } from '../index';
import { Integration, IntegrationType } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export class IntegrationService {
  // Connect a new integration
  static async connectIntegration(data: {
    userId: string;
    name: string;
    type: string;
    config: any;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
  }) {
    // Cast type to IntegrationType enum
    const integrationType = IntegrationType[data.type.toUpperCase() as keyof typeof IntegrationType];
    if (!integrationType) throw new Error('Invalid integration type');
    return prisma.integration.create({
      data: {
        ...data,
        type: integrationType,
      },
    });
  }

  // List integrations for a user
  static async getUserIntegrations(userId: string) {
    return prisma.integration.findMany({ where: { userId } });
  }

  // Remove an integration
  static async removeIntegration(id: string) {
    return prisma.integration.delete({ where: { id } });
  }

  // Gmail Integration
  static async sendGmail(accessToken: string, to: string, subject: string, body: string) {
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

      const result: any = await response.json();
      logger.info('Email sent successfully', { messageId: result.id });
      return result;
    } catch (error) {
      logger.error('Error sending Gmail:', error);
      throw error;
    }
  }

  // Slack Integration
  static async sendSlackMessage(accessToken: string, channel: string, text: string) {
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

      const result: any = await response.json();
      if (!result.ok) {
        throw new Error(`Slack error: ${result.error}`);
      }

      logger.info('Slack message sent successfully', { channel, timestamp: result.ts });
      return result;
    } catch (error) {
      logger.error('Error sending Slack message:', error);
      throw error;
    }
  }

  // Google Sheets Integration
  static async addRowToSheet(accessToken: string, spreadsheetId: string, range: string, values: any[][]) {
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Google Sheets API error: ${response.statusText}`);
      }

      const result: any = await response.json();
      logger.info('Row added to Google Sheets', { spreadsheetId, range });
      return result;
    } catch (error) {
      logger.error('Error adding row to Google Sheets:', error);
      throw error;
    }
  }

  // OpenAI Integration for AI processing
  static async callOpenAI(prompt: string, model: string = 'gpt-3.5-turbo') {
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

      const result: any = await response.json();
      logger.info('OpenAI API call successful');
      return result.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Error calling OpenAI:', error);
      throw error;
    }
  }

  // Hugging Face Integration for Sentiment Analysis
  static async analyzeSentiment(text: string) {
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: text })
        }
      );

      if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.statusText}`);
      }

      const result: any = await response.json();
      logger.info('Sentiment analysis completed');
      
      // Return the sentiment with highest score
      const sentiment = result[0]?.reduce((prev: any, current: any) => 
        prev.score > current.score ? prev : current
      );

      return {
        sentiment: sentiment?.label || 'NEUTRAL',
        confidence: sentiment?.score || 0,
        raw: result
      };
    } catch (error) {
      logger.error('Error analyzing sentiment:', error);
      throw error;
    }
  }

  // HTTP Request Integration (for custom APIs)
  static async makeHttpRequest(url: string, method: string = 'GET', headers: any = {}, body: any = null) {
    try {
      const options: any = {
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
      } else {
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
    } catch (error) {
      logger.error('Error making HTTP request:', error);
      throw error;
    }
  }

  // Helper method to create email raw format for Gmail
  private static createEmailRaw(to: string, subject: string, body: string): string {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body
    ].join('\n');

    return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }
}
