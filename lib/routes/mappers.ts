// lib/routes/mappers.ts
import type { CatalogRoute, Difficulty, TrafficLevel } from './types';
import type { RouteShape } from '@/lib/ride';

export type RouteRow = {
  id: string;
  name: string;
  distance_km: number;
  difficulty: Difficulty;
  shape: RouteShape;
  pace_kmh: number;
  riders: number;
  draft_percent: number;
  traffic: TrafficLevel;
  note: string | null;
  created_at: string;
};

export function rowToCatalogRoute(row: RouteRow): CatalogRoute {
  return {
    id: row.id,
    name: row.name,
    distanceKm: row.distance_km,
    difficulty: row.difficulty,
    shape: row.shape,
    paceKmh: row.pace_kmh,
    riders: row.riders,
    draftPercent: row.draft_percent,
    traffic: row.traffic,
    note: row.note ?? undefined,
  };
}
