import { createLogger } from '../utils/logger';

const logger = createLogger();

export class KeepAliveService {
  private static interval: NodeJS.Timeout | null = null;
  private static readonly PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private static readonly HEALTH_ENDPOINT = '/api/health';

  /**
   * Start the keep-alive service to prevent server from sleeping
   */
  static start(): void {
    if (this.interval) {
      logger.warn('Keep-alive service is already running');
      return;
    }

    const baseUrl = process.env.BASE_URL;
    if (!baseUrl || baseUrl.includes('localhost')) {
      logger.info('Keep-alive service disabled for local development');
      return;
    }

    logger.info(`Starting keep-alive service with ${this.PING_INTERVAL / 1000 / 60} minute intervals`);
    
    this.interval = setInterval(async () => {
      try {
        await this.pingServer(baseUrl);
      } catch (error) {
        logger.error('Keep-alive ping failed:', error);
      }
    }, this.PING_INTERVAL);

    // Initial ping after 30 seconds
    setTimeout(async () => {
      try {
        await this.pingServer(baseUrl);
      } catch (error) {
        logger.error('Initial keep-alive ping failed:', error);
      }
    }, 30000);
  }

  /**
   * Stop the keep-alive service
   */
  static stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Keep-alive service stopped');
    }
  }

  /**
   * Ping the server health endpoint
   */
  private static async pingServer(baseUrl: string): Promise<void> {
    const healthUrl = `${baseUrl}${this.HEALTH_ENDPOINT}`;
    
    logger.info(`Pinging server: ${healthUrl}`);
    
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'KeepAlive-Service/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        const data = await response.json() as { status?: string; timestamp?: string };
        logger.info('Keep-alive ping successful:', {
          status: response.status,
          timestamp: new Date().toISOString(),
          serverStatus: data.status
        });
      } else {
        logger.warn(`Keep-alive ping returned status ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Keep-alive ping failed: ${error.message}`);
      } else {
        logger.error('Keep-alive ping failed with unknown error');
      }
      throw error;
    }
  }

  /**
   * Get the current status of the keep-alive service
   */
  static getStatus(): { running: boolean; interval: number } {
    return {
      running: this.interval !== null,
      interval: this.PING_INTERVAL
    };
  }
}