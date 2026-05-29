import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import prisma from './prisma';

const expo = new Expo();

export async function sendPushNotificationToAdmins(title: string, body: string, data?: any) {
  try {
    // Cari semua admin/kasir yang punya expoPushToken
    const users = await prisma.user.findMany({
      where: {
        expoPushToken: { not: null },
        isActive: true,
      },
    });

    if (users.length === 0) return;

    const messages: ExpoPushMessage[] = [];
    for (const user of users) {
      if (user.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
        messages.push({
          to: user.expoPushToken,
          sound: 'default',
          title,
          body,
          data: data || {},
        });
      }
    }

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Error sending push chunk:', error);
      }
    }
  } catch (error) {
    console.error('Failed to send push notification:', error);
  }
}
