import { prisma } from '../index';

export class DashboardService {
  // Get usage stats for a user
  static async getUserStats(userId: string) {
    const workflows = await prisma.workflow.count({ where: { userId } });
    const executions = await prisma.workflowExecution.count({ where: { userId } });
    const integrations = await prisma.integration.count({ where: { userId } });
    return { workflows, executions, integrations };
  }

  // Get recent executions for dashboard
  static async getRecentExecutions(userId: string, limit = 10) {
    return prisma.workflowExecution.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }
}
