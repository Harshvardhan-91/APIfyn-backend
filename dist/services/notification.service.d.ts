export declare class NotificationService {
    static createNotification(data: {
        userId: string;
        title: string;
        message: string;
        type: string;
        metadata?: any;
        actionUrl?: string;
    }): Promise<{
        message: string;
        id: string;
        createdAt: Date;
        userId: string;
        type: import(".prisma/client").$Enums.NotificationType;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        title: string;
        isRead: boolean;
        actionUrl: string | null;
        readAt: Date | null;
    }>;
    static getUserNotifications(userId: string): Promise<{
        message: string;
        id: string;
        createdAt: Date;
        userId: string;
        type: import(".prisma/client").$Enums.NotificationType;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        title: string;
        isRead: boolean;
        actionUrl: string | null;
        readAt: Date | null;
    }[]>;
    static markAsRead(id: string): Promise<{
        message: string;
        id: string;
        createdAt: Date;
        userId: string;
        type: import(".prisma/client").$Enums.NotificationType;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        title: string;
        isRead: boolean;
        actionUrl: string | null;
        readAt: Date | null;
    }>;
}
//# sourceMappingURL=notification.service.d.ts.map