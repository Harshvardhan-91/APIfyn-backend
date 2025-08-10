export declare class IntegrationService {
    static connectIntegration(data: {
        userId: string;
        name: string;
        type: string;
        config: any;
        accessToken?: string;
        refreshToken?: string;
        tokenExpiresAt?: Date;
    }): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        type: import(".prisma/client").$Enums.IntegrationType;
        lastUsedAt: Date | null;
        isActive: boolean;
        config: import("@prisma/client/runtime/library").JsonValue;
        accessToken: string | null;
        refreshToken: string | null;
        tokenExpiresAt: Date | null;
        totalCalls: number;
    }>;
    static getUserIntegrations(userId: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        type: import(".prisma/client").$Enums.IntegrationType;
        lastUsedAt: Date | null;
        isActive: boolean;
        config: import("@prisma/client/runtime/library").JsonValue;
        accessToken: string | null;
        refreshToken: string | null;
        tokenExpiresAt: Date | null;
        totalCalls: number;
    }[]>;
    static removeIntegration(id: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        type: import(".prisma/client").$Enums.IntegrationType;
        lastUsedAt: Date | null;
        isActive: boolean;
        config: import("@prisma/client/runtime/library").JsonValue;
        accessToken: string | null;
        refreshToken: string | null;
        tokenExpiresAt: Date | null;
        totalCalls: number;
    }>;
    static sendGmail(accessToken: string, to: string, subject: string, body: string): Promise<any>;
    static sendSlackMessage(accessToken: string, channel: string, text: string): Promise<any>;
    static addGoogleSheetsRow(accessToken: string, spreadsheetId: string, range: string, values: string[]): Promise<any>;
    static addRowToSheet(accessToken: string, spreadsheetId: string, range: string, values: any[][]): Promise<any>;
    static callOpenAI(prompt: string, model?: string): Promise<any>;
    static analyzeSentiment(text: string): Promise<{
        sentiment: any;
        confidence: any;
        raw: any;
    }>;
    static makeHttpRequest(url: string, method?: string, headers?: any, body?: any): Promise<{
        status: number;
        statusText: string;
        data: unknown;
        headers: {
            [k: string]: string;
        };
    }>;
    private static createEmailRaw;
}
//# sourceMappingURL=integration.service.d.ts.map