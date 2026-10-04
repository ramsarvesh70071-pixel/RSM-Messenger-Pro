import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

// Configure notification presentation when app is in foreground
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.warn('[NotificationService] setNotificationHandler initialization skipped:', e);
}

export class NotificationService {
  static async registerForPushNotifications(): Promise<string | null> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        return null;
      }

      // Configure Android Notification Channels
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Messages',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#25D366',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('calls', {
          name: 'Calls',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 500, 500],
          lightColor: '#00A884',
          sound: 'default',
        });
      }

      // Fetch Expo Push Token
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const pushToken = tokenData.data;

      if (pushToken) {
        // Register token with backend server
        await api.updatePushToken(pushToken);
        console.log('Registered Expo push token with backend:', pushToken);
      }

      return pushToken;
    } catch (err: any) {
      console.warn('Could not register push token:', err.message);
      return null;
    }
  }

  static addNotificationResponseListener(onNotificationTap: (data: Record<string, any>) => void) {
    try {
      return Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response?.notification?.request?.content?.data;
        if (data) {
          onNotificationTap(data);
        }
      });
    } catch (e) {
      console.warn('[NotificationService] addNotificationResponseListener failed:', e);
      return { remove: () => {} };
    }
  }
}
