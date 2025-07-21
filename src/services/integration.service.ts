import { prisma } from '../index';
import { Integration, IntegrationType } from '@prisma/client';

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
}
