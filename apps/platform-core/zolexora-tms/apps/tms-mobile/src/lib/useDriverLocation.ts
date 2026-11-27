/**
 * useDriverLocation – GPS utilities for the driver persona.
 *
 * Usage:
 *   const { getLocation, startTracking, stopTracking, currentLocation } = useDriverLocation(tripId);
 *
 * - getLocation()     → one-shot: returns { latitude, longitude } or null
 * - startTracking()   → posts a TripEvent every EMIT_INTERVAL_MS while IN_TRANSIT
 * - stopTracking()    → stops the interval
 * - currentLocation  → last known coords (null until first fix)
 */

import { useState, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { apiClient } from './api';

const EMIT_INTERVAL_MS = 30_000; // post location every 30 s while tracking

export interface Coords {
  latitude: number;
  longitude: number;
}

export function useDriverLocation(tripId: string | null | undefined) {
  const [currentLocation, setCurrentLocation] = useState<Coords | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Request foreground permission and return current coords (or null). */
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

  /** Post a location ping to the backend as a TripEvent. */
  const postLocationEvent = useCallback(async (coords: Coords) => {
    if (!tripId) return;
    await apiClient(`/api/v1/trips/${tripId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'location_update',
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
    }).catch(() => {
      // Best-effort; swallow network errors during tracking
    });
  }, [tripId]);

  /**
   * Start streaming location to the backend every EMIT_INTERVAL_MS.
   * Call after trip start is confirmed.
   */
  const startTracking = useCallback(async () => {
    if (intervalRef.current) return; // already tracking
    const coords = await getLocation();
    if (coords) {
      postLocationEvent(coords);
      setCurrentLocation(coords);
    }
    intervalRef.current = setInterval(async () => {
      const c = await getLocation();
      if (c) postLocationEvent(c);
    }, EMIT_INTERVAL_MS);
  }, [getLocation, postLocationEvent]);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return { getLocation, startTracking, stopTracking, currentLocation };
}
