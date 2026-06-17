import type { LatLng, RouteResult } from '@/lib/maps';

/** A resolved waypoint — either a typed/picked place or auto-detected GPS. */
export type Endpoint = {
  /** What the user sees in the input. */
  query: string;
  /** Coordinates. `null` while the user is typing but hasn't picked yet. */
  coords: LatLng | null;
  /**
   * `'auto'` = live current location (the value follows GPS).
   * `'manual'` = user typed / picked a value (decoupled from GPS).
   * `'empty'` = nothing yet.
   */
  source: 'auto' | 'manual' | 'empty';
};

export const EMPTY_ENDPOINT: Endpoint = { query: '', coords: null, source: 'empty' };

export type RouteState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; route: RouteResult }
  | { kind: 'error'; message: string };

/**
 * Which input is currently active (focused or in pick-on-map mode).
 * Drives both the predictions dropdown and the map-tap routing.
 */
export type Field = 'origin' | 'destination';
