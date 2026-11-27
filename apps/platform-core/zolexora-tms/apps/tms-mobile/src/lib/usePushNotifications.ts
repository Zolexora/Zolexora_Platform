/**
 * usePushNotifications – registers the device Expo push token with the backend
 * and deep-links notification taps straight to the relevant Duty screen.
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from './api';

/** Configure foreground notification presentation (show banner + sound). */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications(isAuthenticated: boolean) {
  const registered = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || registered.current) return;

    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token) return;

        const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
        await apiClient('/api/v1/devices/register-push-token', {
          method: 'POST',
          body: JSON.stringify({ token, platform }),
        });
        registered.current = true;
      } catch {
        // Best-effort: push registration failure must never block the app
      }
    })();

    return () => {
      registered.current = false;
    };
  }, [isAuthenticated]);

  // Deep-link when the user taps a push notification (warm or cold start)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification?.request?.content?.data as
        | { screen?: string; duty_id?: string }
        | undefined;
      if (data?.screen === 'duty' && data?.duty_id) {
        router.push(`/duty/${data.duty_id}`);
      }
    };

    Notifications.getLastNotificationResponseAsync()
      .then((res) => handleResponse(res))
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [isAuthenticated, router]);
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications.getExpoPushTokenAsync) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}
