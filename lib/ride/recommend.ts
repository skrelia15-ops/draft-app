import type { LatLng } from '@/lib/maps';
import type { CatalogRoute, Difficulty } from '@/lib/routes';
import type { Conditions } from './conditions';
import type { Profile } from '@/lib/profile';
import { catalogToCandidate, loopToCandidate, type RouteCandidate } from './routeCandidate';
import { scoreTodayFit, type TodayFit } from './todayFit';

export type Recommendation = { candidate: RouteCandidate; fit: TodayFit };

const SKILL_DIFFICULTY: Record<Profile['skillLevel'], Difficulty> = {
  Novice: 'EASY', Pro: 'MODERATE', Elite: 'HARD',
};

/**
 * Rank candidate routes by today's fit. Pool = catalog routes (when an origin
 * is known, adapted to schematic previews near it) plus generated loops to
 * backfill up to `maxResults` when the catalog is sparse. With no origin we
 * rank the catalog alone (no spatial generation possible).
 */
export function recommendRoutes(args: {
  catalog: CatalogRoute[];
  origin: LatLng | null;
  conditions: Conditions;
  profile: Profile;
  targetDistanceKm?: number;
  maxResults?: number;
}): Recommendation[] {
  const { catalog, origin, conditions, profile, targetDistanceKm, maxResults = 3 } = args;

  const ctx = { conditions, profile, targetDistanceKm };

  const anchor = origin ?? { latitude: 0, longitude: 0 };
  const catalogCands = catalog.map((r) => catalogToCandidate(r, anchor));

  const generated: RouteCandidate[] = [];
  if (origin && catalogCands.length < maxResults) {
    const need = maxResults - catalogCands.length;
    const dist = targetDistanceKm && targetDistanceKm > 0 ? targetDistanceKm : 15;
    for (let i = 0; i < need; i++) {
      generated.push(
        loopToCandidate({
          origin, distanceKm: dist, seed: 1000 + i,
          difficulty: SKILL_DIFFICULTY[profile.skillLevel], paceKmh: profile.avgPaceKmh,
          id: `gen-${i}`, name: `Nearby loop ${i + 1}`,
        }),
      );
    }
  }

  const pool = [...catalogCands, ...generated];
  return pool
    .map((candidate) => ({ candidate, fit: scoreTodayFit(candidate, ctx) }))
    .sort((a, b) => b.fit.score - a.fit.score)
    .slice(0, maxResults);
}
