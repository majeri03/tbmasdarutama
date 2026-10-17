import { NotificationService } from './services/notification.service';
import { NotificationType } from '@prisma/client';

export async function sendPushNotificationToAdmins(
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  await NotificationService.send({
    role: 'ADMIN',
    title,
    body,
    type: (data?.type as NotificationType) ?? 'SYSTEM_ALERT',
    screen: (data?.screen as string) ?? 'NotificationCenter',
    params: data?.params as Record<string, unknown>,
  });
}

