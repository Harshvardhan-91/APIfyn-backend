"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionService = void 0;
const index_1 = require("../index");
class ExecutionService {
    static async logExecution(data) {
        const { ExecutionStatus } = require('@prisma/client');
        const statusEnum = ExecutionStatus[data.status.toUpperCase()];
        if (!statusEnum)
            throw new Error('Invalid execution status');
        return index_1.prisma.workflowExecution.create({
            data: {
                ...data,
                status: statusEnum,
            },
        });
    }
    static async getWorkflowExecutions(workflowId) {
        return index_1.prisma.workflowExecution.findMany({ where: { workflowId } });
    }
    static async getExecution(id) {
        return index_1.prisma.workflowExecution.findUnique({ where: { id } });
    }
    static async retryExecution(id) {
        return index_1.prisma.workflowExecution.update({ where: { id }, data: { status: 'PENDING' } });
    }
}
exports.ExecutionService = ExecutionService;
//# sourceMappingURL=execution.service.js.map