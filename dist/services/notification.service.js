"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const index_1 = require("../index");
const client_1 = require("@prisma/client");
class NotificationService {
    static async createNotification(data) {
        const typeEnum = client_1.NotificationType[data.type.toUpperCase()];
        if (!typeEnum)
            throw new Error('Invalid notification type');
        return index_1.prisma.notification.create({
            data: {
                ...data,
                type: typeEnum,
            },
        });
    }
    static async getUserNotifications(userId) {
        return index_1.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    }
    static async markAsRead(id) {
        return index_1.prisma.notification.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=notification.service.js.map