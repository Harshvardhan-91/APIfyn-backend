export declare class DashboardService {
    static getUserStats(userId: string): Promise<{
        workflows: number;
        executions: number;
        integrations: number;
    }>;
    static getRecentExecutions(userId: string, limit?: number): Promise<{
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ExecutionStatus;
        userId: string;
        startedAt: Date;
        completedAt: Date | null;
        duration: number | null;
        inputData: import("@prisma/client/runtime/library").JsonValue | null;
        outputData: import("@prisma/client/runtime/library").JsonValue | null;
        errorMessage: string | null;
        errorStack: string | null;
        stepsExecuted: import("@prisma/client/runtime/library").JsonValue[];
        currentStep: number | null;
        totalSteps: number | null;
        triggerSource: string | null;
        executionMode: import(".prisma/client").$Enums.ExecutionMode;
        workflowId: string;
    }[]>;
}
//# sourceMappingURL=dashboard.service.d.ts.map