/**
 * useDriverLocation – foreground + background GPS tracking hook for drivers.
 *
 * Uses Option B (expo-task-manager + Location.startLocationUpdatesAsync) when
 * background permission is granted, and falls back to foreground polling while
 * the screen is active if the user selected "While Using App".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  isBackgroundTrackingActive,
  recordForegroundLocationPing,
  startBackgroundTripTracking,
  stopBackgroundTripTracking,
} from './backgroundLocationTask';

const FG_EMIT_INTERVAL_MS = 30_000;

export interface Coords {
  latitude: number;
  longitude: number;
}

export function useDriverLocation(tripId: string | null | undefined) {
  const [currentLocation, setCurrentLocation] = useState<Coords | null>(null);
  const [isBackgroundActive, setIsBackgroundActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    isBackgroundTrackingActive().then(setIsBackgroundActive).catch(() => {});
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  /** Request foreground permission and capture a one-shot GPS fix. */
  const getLocation = useCallback(async (): Promise<Coords | null> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords: Coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCurrentLocation(coords);
      return coords;
    } catch {
      return null;
    }
  }, []);

  /**
   * Starts background GPS updates (or foreground fallback) for the given trip.
   */
  const startTracking = useCallback(
    async (overrideTripId?: string): Promise<boolean> => {
      const targetTripId = overrideTripId ?? tripId;
      if (!targetTripId) return false;

      const bgStarted = await startBackgroundTripTracking(targetTripId);
      setIsBackgroundActive(bgStarted);

      const coords = await getLocation();
      if (coords) {
        await recordForegroundLocationPing(targetTripId, coords.latitude, coords.longitude);
      }

      // If background permission was denied, maintain a foreground interval while mounted
      if (!bgStarted && !intervalRef.current) {
        intervalRef.current = setInterval(async () => {
          const c = await getLocation();
          if (c) await recordForegroundLocationPing(targetTripId, c.latitude, c.longitude);
        }, FG_EMIT_INTERVAL_MS);
      }
      return true;
    },
    [getLocation, tripId],
  );

  const stopTracking = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    await stopBackgroundTripTracking();
    setIsBackgroundActive(false);
  }, []);

  return { getLocation, startTracking, stopTracking, currentLocation, isBackgroundActive };
}
