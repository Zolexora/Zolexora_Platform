/**
 * Background GPS task for active driver trips (Option B).
 *
 * IMPORTANT: TaskManager.defineTask MUST execute at module top-level when the
 * JS bundle initializes. Import this module once in app/_layout.tsx.
 *
 * Offline resilience:
 * - Failed pings are buffered in storage (capped at 20 points to respect
 *   Android SecureStore size limits) and flushed before new pings once online.
 * - Stops cleanly on trip completion, duty arrival, or sign-out.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { apiClient } from './api';
import { QueuedGpsPing, storage } from './storage';

export const DRIVER_LOCATION_TASK = 'zolexora-driver-trip-location';

async function sendPing(ping: QueuedGpsPing): Promise<void> {
  await apiClient(`/api/v1/trips/${ping.tripId}/events`, {
    method: 'POST',
    body: JSON.stringify({
      event_type: 'location_update',
      latitude: ping.latitude,
      longitude: ping.longitude,
      timestamp: ping.timestamp,
    }),
  });
}

/** Flush buffered offline pings FIFO and enqueue any pings that still fail. */
async function deliverWithQueue(freshPings: QueuedGpsPing[]): Promise<void> {
  const pending = [...(await storage.getQueuedGpsPings()), ...freshPings];
  if (pending.length === 0) return;

  const remaining: QueuedGpsPing[] = [];
  for (let i = 0; i < pending.length; i += 1) {
    try {
      await sendPing(pending[i]);
    } catch {
      // Stop on first transient error and preserve ordering of remaining pings
      remaining.push(...pending.slice(i));
      break;
    }
  }
  await storage.setQueuedGpsPings(remaining);
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(DRIVER_LOCATION_TASK)) {
  TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const tripId = await storage.getActiveTrackingTripId();
    if (!tripId) return;

    const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
    if (locations.length === 0) return;

    const latest = locations[locations.length - 1];
    await deliverWithQueue([
      {
        tripId,
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
        timestamp: new Date(latest.timestamp || Date.now()).toISOString(),
      },
    ]);
  });
}

export async function isBackgroundTrackingActive(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  } catch {
    return false;
  }
}

export async function startBackgroundTripTracking(tripId: string): Promise<boolean> {
  await storage.setActiveTrackingTripId(tripId);
  if (Platform.OS === 'web') return false;

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;

  // Background permission is required for lock-screen / navigation tracking;
  // fall back to foreground-only updates gracefully if user selects "While Using".
  const bg = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: 'denied' }));
  const alreadyRunning = await isBackgroundTrackingActive();
  if (alreadyRunning) return true;

  if (bg.status === 'granted') {
    await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30_000,
      distanceInterval: 50,
      deferredUpdatesInterval: 30_000,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'Zolexora TMS — Live Trip Tracking',
        notificationBody: 'Sharing GPS location while your trip is in transit.',
        notificationColor: '#1A56DB',
      },
    });
    return true;
  }

  return false;
}

export async function stopBackgroundTripTracking(): Promise<void> {
  await storage.setActiveTrackingTripId(null);
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
    }
  } catch {
    // Ignore if task was already torn down by OS
  }
}

export async function recordForegroundLocationPing(
  tripId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  await deliverWithQueue([
    { tripId, latitude, longitude, timestamp: new Date().toISOString() },
  ]);
}
