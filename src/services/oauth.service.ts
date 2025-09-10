import { prisma } from '../db';
import { createLogger } from '../utils/logger';

const logger = createLogger();

// Type definitions for OAuth responses
export interface GitHubTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
}

export interface GitHubUserResponse {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  email: string;
}

export interface SlackTokenResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  team: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
  };
  error?: string;
}

export interface SlackChannelsResponse {
  ok: boolean;
  channels: Array<{
    id: string;
    name: string;
    is_private: boolean;
    is_channel: boolean;
    is_group: boolean;
  }>;
  error?: string;
}

export class OAuthService {
  // GitHub OAuth methods
  static generateGitHubAuthUrl(userId: string): string {
    const githubClientId = process.env.GITHUB_CLIENT_ID;
    if (!githubClientId) {
      throw new Error('GitHub OAuth not configured');
    }

    const state = `${userId}_${Date.now()}`;
    const scope = 'repo,read:user';
    return `https://github.com/login/oauth/authorize?client_id=${githubClientId}&scope=${scope}&state=${state}`;
  }

  static async exchangeGitHubCode(code: string): Promise<GitHubTokenResponse> {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json() as GitHubTokenResponse;
    
    if (tokenData.error) {
      throw new Error(tokenData.error_description || 'Failed to get access token');
    }

    return tokenData;
  }

  static async getGitHubUser(accessToken: string): Promise<GitHubUserResponse> {
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch GitHub user');
    }

    return await userResponse.json() as GitHubUserResponse;
  }

  static async saveGitHubIntegration(userId: string, tokenData: GitHubTokenResponse, userData: GitHubUserResponse) {
    const existingIntegration = await prisma.integration.findFirst({
      where: {
        userId,
        type: 'GITHUB'
      }
    });

    const integrationData = {
      name: `${userData.login}'s GitHub`,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      config: {
        login: userData.login,
        name: userData.name,
        avatar_url: userData.avatar_url,
        id: userData.id
      },
      tokenExpiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null
    };

    if (existingIntegration) {
      return await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: integrationData
      });
    } else {
      return await prisma.integration.create({
        data: {
          userId,
          type: 'GITHUB',
          ...integrationData
        }
      });
    }
  }

  // Slack OAuth methods
  static generateSlackAuthUrl(userId: string): string {
    const slackClientId = process.env.SLACK_CLIENT_ID;
    if (!slackClientId) {
      throw new Error('Slack OAuth not configured');
    }

    const state = `${userId}_${Date.now()}`;
    // Updated scope to include all necessary permissions
    const scope = 'channels:read,groups:read,im:read,mpim:read,chat:write,chat:write.public,users:read,team:read';
    return `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=${scope}&state=${state}`;
  }

  static async exchangeSlackCode(code: string): Promise<SlackTokenResponse> {
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
      }),
    });

    const tokenData = await tokenResponse.json() as SlackTokenResponse;
    
    if (!tokenData.ok) {
      throw new Error(tokenData.error || 'Failed to get access token');
    }

    return tokenData;
  }

  static async saveSlackIntegration(userId: string, tokenData: SlackTokenResponse) {
    const existingIntegration = await prisma.integration.findFirst({
      where: {
        userId,
        type: 'SLACK'
      }
    });

    const integrationData = {
      name: `${tokenData.team.name} Slack`,
      accessToken: tokenData.access_token,
      config: {
        team: tokenData.team,
        authed_user: tokenData.authed_user,
        scope: tokenData.scope
      }
    };

    if (existingIntegration) {
      return await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: integrationData
      });
    } else {
      return await prisma.integration.create({
        data: {
          userId,
          type: 'SLACK',
          ...integrationData
        }
      });
    }
  }

  // Get repositories from GitHub
  static async getGitHubRepositories(accessToken: string) {
    const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!reposResponse.ok) {
      throw new Error('Failed to fetch repositories');
    }

    const repositories = await reposResponse.json() as any[];
    return repositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      description: repo.description,
      html_url: repo.html_url,
      updated_at: repo.updated_at
    }));
  }

  // Get channels from Slack
  static async getSlackChannels(accessToken: string) {
    try {
      const channelsResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=100', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const channelsData = await channelsResponse.json() as SlackChannelsResponse;
      
      if (!channelsData.ok) {
        if (channelsData.error === 'missing_scope') {
          throw new Error('Slack integration needs to be re-authorized with updated permissions. Please disconnect and reconnect your Slack account.');
        }
        throw new Error(channelsData.error || 'Failed to fetch channels');
      }

      return channelsData.channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        is_private: channel.is_private,
        is_channel: channel.is_channel,
        is_group: channel.is_group
      }));
    } catch (error) {
      logger.error('Error fetching Slack channels:', error);
      throw error;
    }
  }
}
