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
