export interface WorkflowStep {
    id: string;
    type: 'trigger' | 'action' | 'condition' | 'utility';
    blockType: string;
    config: any;
    position: {
        x: number;
        y: number;
    };
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
export declare class ExecutionEngine {
    private static processStep;
    private static processWebhookTrigger;
    private static processGmailTrigger;
    private static processTypeformTrigger;
    private static processGmailSend;
    private static processSlackSend;
    private static processGoogleSheetsAddRow;
    private static processWebhookPost;
    private static processAISentiment;
    private static processAIKeywords;
    private static processDelay;
    private static processFormatter;
    private static processCondition;
    private static processLogger;
    static executeWorkflow(workflowId: string, triggerData?: any, executionMode?: 'NORMAL' | 'TEST'): Promise<any>;
    private static getIntegration;
    private static replaceVariables;
    private static replaceObjectVariables;
    private static shouldFollowConnection;
    private static callHuggingFaceAPI;
    private static extractKeywords;
}
//# sourceMappingURL=execution.engine.d.ts.map