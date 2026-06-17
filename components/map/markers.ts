import type { LatLng } from '@/lib/maps';

/** Compass label → bearing in degrees (N = 0, clockwise). */
export function compassBearing(compass: string): number {
  const map: Record<string, number> = {
    N: 0,
    NE: 45,
    E: 90,
    SE: 135,
    S: 180,
    SW: 225,
    W: 270,
    NW: 315,
  };
  return map[compass] ?? 0;
}

/** Project a base coordinate `meters` along `bearingDeg` into a new LatLng. */
export function offsetCoords(
  base: LatLng,
  meters: number,
  bearingDeg: number,
): LatLng {
  const R = 6378137; // Earth radius, meters
  const d = meters / R;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (base.latitude * Math.PI) / 180;
  const lon1 = (base.longitude * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI };
}
