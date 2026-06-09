import type { LatLng } from './polyline';

/**
 * Fallback map anchor used when the user's GPS is unavailable. Odessa city
 * center. With a GPS fix the app anchors to the user instead; this is only
 * the no-location fallback.
 */
export const ODESSA: LatLng = { latitude: 46.4825, longitude: 30.7233 };
