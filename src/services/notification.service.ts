import { prisma } from '../index';
import { NotificationType } from '@prisma/client';

export class NotificationService {
  // Create a notification
  static async createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type: string;
    metadata?: any;
    actionUrl?: string;
  }) {
    const typeEnum = NotificationType[data.type.toUpperCase() as keyof typeof NotificationType];
    if (!typeEnum) throw new Error('Invalid notification type');
    return prisma.notification.create({
      data: {
        ...data,
        type: typeEnum,
      },
    });
  }

  // List notifications for a user
  static async getUserNotifications(userId: string) {
    return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  // Mark notification as read
  static async markAsRead(id: string) {
    return prisma.notification.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
  }
}
