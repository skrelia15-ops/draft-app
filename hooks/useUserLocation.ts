import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import type { LatLng } from '@/lib/maps';

export type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'error';

export type UseUserLocationResult = {
  status: LocationStatus;
  /** Latest coordinates from the device (or `null` until first fix). */
  coords: LatLng | null;
  /** Best-effort heading in degrees (0–360). */
  heading: number | null;
  errorMessage: string | null;
  retry: () => void;
};

/**
 * Foreground location hook.
 *
 * - Requests "When In Use" permission once on mount.
 * - Reads `getLastKnownPositionAsync` for an instant fix, then upgrades to
 *   `getCurrentPositionAsync` for accuracy.
 * - Subscribes to `watchPositionAsync` so the user dot updates while panning.
 * - Cleans up the subscription on unmount.
 *
 * Designed to be safe to call before the user even sees the map — the screen
 * can render a "permission denied" fallback by branching on `status`.
 */
export function useUserLocation(): UseUserLocationResult {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const cancelledRef = useRef(false);

  const start = useCallback(async () => {
    setStatus('requesting');
    setErrorMessage(null);

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setStatus('unavailable');
        setErrorMessage('Location services are turned off on this device.');
        return;
      }

      const { status: permission } =
        await Location.requestForegroundPermissionsAsync();
      if (cancelledRef.current) return;

      if (permission !== 'granted') {
        setStatus('denied');
        setErrorMessage('Location permission was denied.');
        return;
      }

      const last = await Location.getLastKnownPositionAsync();
      if (last && !cancelledRef.current) {
        setCoords({
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
        });
        if (typeof last.coords.heading === 'number') {
          setHeading(last.coords.heading);
        }
      }

      const fresh = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (cancelledRef.current) return;
      setCoords({
        latitude: fresh.coords.latitude,
        longitude: fresh.coords.longitude,
      });
      if (typeof fresh.coords.heading === 'number') {
        setHeading(fresh.coords.heading);
      }
      setStatus('granted');

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 5,
          timeInterval: 4_000,
        },
        (update) => {
          // A queued fix can still fire after unmount/retry (subscription
          // removal is async) — guard against setState-after-unmount.
          if (cancelledRef.current) return;
          setCoords({
            latitude: update.coords.latitude,
            longitude: update.coords.longitude,
          });
          if (typeof update.coords.heading === 'number') {
            setHeading(update.coords.heading);
          }
        },
      );
    } catch (e) {
      if (cancelledRef.current) return;
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Unknown error.');
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    start();
    return () => {
      cancelledRef.current = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [start]);

  const retry = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    start();
  }, [start]);

  return { status, coords, heading, errorMessage, retry };
}
