/**
 * usePushNotifications – registers the device Expo push token with the backend.
 *
 * Call once after the user authenticates. On iOS, requests permission first.
 * On Android 13+ (SDK 33), also requests permission.
 * Token is upserted via POST /api/v1/devices/register-push-token.
 *
 * Returns the token string (or null if permission denied / simulator).
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
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

    // Reset on logout so the next session re-registers
    return () => { registered.current = false; };
  }, [isAuthenticated]);
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Expo Go / simulators don't support push tokens — return null gracefully
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
    // Will fail on simulators / Expo Go without projectId — that's fine
    return null;
  }
}
