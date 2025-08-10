import { Application } from 'express';
import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<{
    log: ("info" | "error" | "query" | "warn")[];
    datasources: {
        db: {
            url: string;
        };
    };
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
declare const app: Application;
export default app;
//# sourceMappingURL=index.d.ts.map