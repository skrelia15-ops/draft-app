import type { LatLng } from '@/lib/maps';

/** First available wins: live GPS → last-known → fallback default. */
export function pickCoords(
  live: LatLng | null,
  lastKnown: LatLng | null,
  fallback: LatLng,
): LatLng {
  return live ?? lastKnown ?? fallback;
}
