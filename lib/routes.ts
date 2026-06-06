/**
 * Shared route catalog used by Explore (list), RouteDetails (single route
 * view) and Groups (suggestions). Keeping one source of truth means we
 * can't accidentally show different stats for the same route in
 * different screens.
 */
import type { RouteShape } from '@/lib/ride';

export type Difficulty = 'EASY' | 'MODERATE' | 'HARD';
export type TrafficLevel = 'CLEAR' | 'MODERATE' | 'HEAVY';

export type CatalogRoute = {
  id: string;
  name: string;
  distanceKm: number;
  difficulty: Difficulty;
  shape: RouteShape;
  paceKmh: number;
  riders: number;
  draftPercent: number;
  traffic: TrafficLevel;
  /** One-line copy surfaced on cards + detail page. */
  note?: string;
};

export const ROUTE_CATALOG: CatalogRoute[] = [
  {
    id: 'coastal',
    name: 'COASTAL SLIPSTREAM',
    distanceKm: 24.5,
    difficulty: 'MODERATE',
    shape: 'point-to-point',
    paceKmh: 32,
    riders: 8,
    draftPercent: 92,
    traffic: 'MODERATE',
    note: 'Best drafting right now',
  },
  {
    id: 'urban',
    name: 'URBAN DRAFT LOOP',
    distanceKm: 12.2,
    difficulty: 'EASY',
    shape: 'loop',
    paceKmh: 28,
    riders: 15,
    draftPercent: 88,
    traffic: 'CLEAR',
  },
  {
    id: 'mountain',
    name: 'MOUNTAIN PASS',
    distanceKm: 35.0,
    difficulty: 'HARD',
    shape: 'out-and-back',
    paceKmh: 24,
    riders: 4,
    draftPercent: 78,
    traffic: 'CLEAR',
  },
];

export function findRoute(id: string | undefined): CatalogRoute {
  if (!id) return ROUTE_CATALOG[0];
  return ROUTE_CATALOG.find((r) => r.id === id) ?? ROUTE_CATALOG[0];
}

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
