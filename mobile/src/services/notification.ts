import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from './api';

// In Expo Go on Android (SDK 53+), remote push notifications were removed by Expo.
// They are supported in standalone APKs and development builds.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo';

let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
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
    console.warn('[NotificationService] Failed to load expo-notifications:', e);
  }
}

export class NotificationService {
  static async registerForPushNotifications(): Promise<string | null> {
    if (isExpoGo) {
      console.log('[NotificationService] Running in Expo Go: Remote push notifications are disabled in Expo Go (SDK 53+). Working in standalone build.');
      return null;
    }

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
      console.warn('Could not register push token:', err?.message || err);
      return null;
    }
  }

  static addNotificationResponseListener(onNotificationTap: (data: Record<string, any>) => void) {
    if (isExpoGo) {
      return { remove: () => {} };
    }

    try {
      return Notifications.addNotificationResponseReceivedListener((response: any) => {
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
