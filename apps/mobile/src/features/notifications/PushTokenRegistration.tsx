import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { registerPushToken } from '../../services/api/client';
import { useAuth } from '../auth/context';
import { resolveNotificationNavigationRoute } from './notificationNavigation';
import { resolveExpoProjectId } from './notificationProject';
import { TIMEFIT_NOTIFICATION_CHANNELS } from './notificationChannels';

export function PushTokenRegistration() {
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: (await AsyncStorage.getItem('settings.vibrationEnabled')) !== 'false',
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      for (const channel of TIMEFIT_NOTIFICATION_CHANNELS) {
        void Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          importance: channel.importance === 'high' ? Notifications.AndroidImportance.HIGH : Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: channel.vibrationPattern,
          sound: channel.sound,
        });
      }
    }
  }, []);

  useEffect(() => {
    const openNotification = (response: Notifications.NotificationResponse | null) => {
      const route = resolveNotificationNavigationRoute(response?.notification.request.content.data);
      if (route) router.push(route);
    };

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotification(response);
    });
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => openNotification(response))
      .catch(() => undefined);

    return () => responseSubscription.remove();
  }, [router]);

  useEffect(() => {
    if (!isLoggedIn || Platform.OS === 'web') return;
    let cancelled = false;
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    const syncToken = async (token: string) => {
      if (!cancelled) {
        await registerPushToken({ token, platform });
      }
    };

    const syncExpoToken = async () => {
      const projectId = resolveExpoProjectId(Constants);
      if (!projectId || cancelled) return;
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await syncToken(token);
    };

    const syncIfPermitted = async (requestPermission: boolean) => {
      const permission = await Notifications.getPermissionsAsync();
      let status = permission.status;
      if (requestPermission && status !== 'granted') {
        status = (await Notifications.requestPermissionsAsync()).status;
      }
      if (status === 'granted' && !cancelled) {
        await syncExpoToken();
      }
    };

    const tokenSubscription = Notifications.addPushTokenListener(() => {
      // The listener may provide a native APNs/FCM token rather than an
      // ExponentPushToken. Resolve the Expo token again before persisting it.
      void syncExpoToken().catch((error: unknown) => {
        if (!cancelled) console.warn('[Notifications] refreshed push token registration failed', error);
      });
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void syncIfPermitted(false).catch((error: unknown) => {
        if (!cancelled) console.warn('[Notifications] foreground push token sync failed', error);
      });
    });

    void (async () => {
      if (!resolveExpoProjectId(Constants)) {
        console.warn('[Notifications] Expo project ID is missing; push token registration skipped');
        return;
      }
      await syncIfPermitted(true);
    })().catch((error: unknown) => {
      if (!cancelled) console.warn('[Notifications] push token registration failed', error);
    });

    return () => {
      cancelled = true;
      tokenSubscription.remove();
      appStateSubscription.remove();
    };
  }, [isLoggedIn]);

  return null;
}
