import { Device, Notification } from '../models';
import { env } from '../config/environment';

export interface PushNotificationPayload {
  recipientId: string;
  senderId?: string;
  type: 'message' | 'group' | 'group_mention' | 'reply' | 'call' | 'status_reaction' | 'system';
  title: string;
  body: string;
  data?: Record<string, any>;
}

export class PushService {
  static async sendPushNotification(payload: PushNotificationPayload): Promise<void> {
    try {
      // 1. Persist notification in database
      await Notification.create({
        recipientId: payload.recipientId,
        senderId: payload.senderId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data
      });

      // 2. Fetch recipient's registered devices with push tokens
      const devices = await Device.find({
        userId: payload.recipientId,
        pushToken: { $exists: true, $ne: '' }
      });

      if (devices.length === 0) {
        console.log(`[PushService] No push tokens found for User ${payload.recipientId}`);
        return;
      }

      console.log(`[PushService] Sending notification to ${devices.length} devices for User ${payload.recipientId}: "${payload.title} - ${payload.body}"`);

      // 3. Send via Expo's Free Push Relay Service
      const expoPushMessages = devices.map((device) => ({
        to: device.pushToken,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        priority: 'high',
        channelId: 'default',
        badge: 1
      }));

      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(expoPushMessages)
        });

        const result = (await response.json()) as any;
        if (result && Array.isArray(result.data)) {
          for (let i = 0; i < result.data.length; i++) {
            const ticket = result.data[i];
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
              const dev = devices[i];
              if (dev) {
                console.log(`[PushService] Removing unregistered push token for device ${dev.deviceId}`);
                await Device.updateOne({ _id: dev._id }, { $unset: { pushToken: 1 } });
              }
            }
          }
        }
      } catch (pushErr: any) {
        console.warn('[PushService] Expo push delivery error:', pushErr.message);
      }
    } catch (err) {
      console.error('[PushService] Error in sendPushNotification:', err);
    }
  }
}
