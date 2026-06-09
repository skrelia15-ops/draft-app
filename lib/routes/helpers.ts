import type { RouteShape } from '@/lib/ride';
import type { CatalogRoute, TrafficLevel } from './types';

export function shapeLabel(shape: RouteShape): string {
  switch (shape) {
    case 'loop':
      return 'Loop';
    case 'out-and-back':
      return 'Out & back';
    case 'point-to-point':
      return 'Point to point';
  }
}

export function trafficLabel(level: TrafficLevel): string {
  if (level === 'CLEAR') return 'Clear';
  if (level === 'MODERATE') return 'Moderate';
  return 'Heavy';
}

export function trafficColor(level: TrafficLevel): string {
  if (level === 'CLEAR') return '#3FBF6E';
  if (level === 'MODERATE') return '#F2A93B';
  return '#E5484D';
}

/**
 * Deterministic id → numeric seed mapping, used by polyline preview
 * generators so the same route always renders the same shape.
 */
export function hashIdSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Find a route in a catalog list, falling back to the first entry (or
 *  undefined if the catalog is empty / still loading). */
export function findRouteIn(
  routes: CatalogRoute[],
  id: string | undefined,
): CatalogRoute | undefined {
  if (routes.length === 0) return undefined;
  if (!id) return routes[0];
  return routes.find((r) => r.id === id) ?? routes[0];
}
