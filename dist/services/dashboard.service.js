"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const index_1 = require("../index");
class DashboardService {
    static async getUserStats(userId) {
        const workflows = await index_1.prisma.workflow.count({ where: { userId } });
        const executions = await index_1.prisma.workflowExecution.count({ where: { userId } });
        const integrations = await index_1.prisma.integration.count({ where: { userId } });
        return { workflows, executions, integrations };
    }
    static async getRecentExecutions(userId, limit = 10) {
        return index_1.prisma.workflowExecution.findMany({
            where: { userId },
            orderBy: { startedAt: 'desc' },
            take: limit,
        });
    }
}
exports.DashboardService = DashboardService;
//# sourceMappingURL=dashboard.service.js.map