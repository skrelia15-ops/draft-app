import type { LatLng, RouteResult } from '@/lib/maps';
import type { CatalogRoute, Difficulty } from '@/lib/routes';
import { hashIdSeed } from '@/lib/routes';
import type { CompassDirection } from './conditions';
import { buildRoutePreview } from './sampleRoutes';
import type { RouteShape } from './sampleRoutes';

/** Unified shape scored by `scoreTodayFit`, regardless of where it came from. */
export type RouteCandidate = {
  id: string;
  name: string;
  shape: RouteShape;
  distanceKm: number;
  difficulty: Difficulty;
  paceKmh: number;
  coordinates: LatLng[];
  origin: LatLng;
  destination: LatLng;
  /** Dominant heading of the main leg, degrees clockwise from north. */
  bearing: number;
  source: 'catalog' | 'generated' | 'directions';
};

const COMPASS_DEG: Record<CompassDirection, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};

/** Wind compass label → bearing degrees. */
export function compassToBearing(c: CompassDirection): number {
  return COMPASS_DEG[c];
}

/** Initial-bearing (degrees 0–360) from the first to the middle coordinate. */
export function dominantBearing(coords: LatLng[]): number {
  if (coords.length < 2) return 0;
  const a = coords[0];
  const b = coords[Math.floor(coords.length / 2)];
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Adapt a shared-catalog route into a candidate (schematic preview coords). */
export function catalogToCandidate(route: CatalogRoute, origin: LatLng): RouteCandidate {
  const preview = buildRoutePreview({
    origin, shape: route.shape, distanceKm: route.distanceKm, seed: hashIdSeed(route.id),
  });
  return {
    id: route.id, name: route.name, shape: route.shape, distanceKm: route.distanceKm,
    difficulty: route.difficulty, paceKmh: route.paceKmh,
    coordinates: preview.coordinates, origin: preview.origin, destination: preview.destination,
    bearing: dominantBearing(preview.coordinates), source: 'catalog',
  };
}

/** Generate a schematic loop candidate near `origin`. */
export function loopToCandidate(args: {
  origin: LatLng; distanceKm: number; seed: number;
  difficulty: Difficulty; paceKmh: number; id: string; name: string;
}): RouteCandidate {
  const preview = buildRoutePreview({ origin: args.origin, shape: 'loop', distanceKm: args.distanceKm, seed: args.seed });
  return {
    id: args.id, name: args.name, shape: 'loop', distanceKm: args.distanceKm,
    difficulty: args.difficulty, paceKmh: args.paceKmh,
    coordinates: preview.coordinates, origin: preview.origin, destination: preview.destination,
    bearing: dominantBearing(preview.coordinates), source: 'generated',
  };
}

/** Adapt a Google directions result (mode B) into a candidate. */
export function directionsToCandidate(route: RouteResult, opts: {
  id: string; name: string; difficulty: Difficulty; paceKmh: number;
}): RouteCandidate {
  const coords = route.coordinates;
  if (coords.length === 0) {
    throw new Error('directionsToCandidate: route has no coordinates');
  }
  return {
    id: opts.id, name: opts.name, shape: 'point-to-point',
    distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
    difficulty: opts.difficulty, paceKmh: opts.paceKmh,
    coordinates: coords, origin: coords[0], destination: coords[coords.length - 1],
    bearing: dominantBearing(coords), source: 'directions',
  };
}
