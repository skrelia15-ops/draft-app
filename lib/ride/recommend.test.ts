import { recommendRoutes } from './recommend';
import type { CatalogRoute } from '@/lib/routes';
import type { Conditions } from './conditions';
import type { Profile } from '@/lib/profile';

const ODESSA = { latitude: 46.4825, longitude: 30.7233 };
const PROFILE: Profile = { id: 'u', name: 'T', skillLevel: 'Pro', avgPaceKmh: 28, avatarUri: null, bike: null, weeklyRideGoal: 5, updatedAt: 0 };
const COND: Conditions = { windKmh: 12, windFrom: 'N', draftAdvice: '', draftIndex: 92, draftLabel: 'OPTIMAL', tempC: 18, feelsLikeC: 17, isRaining: false, rainMmLastHour: 0 };

function route(id: string, distanceKm: number, difficulty: CatalogRoute['difficulty'] = 'MODERATE'): CatalogRoute {
  return { id, name: `R${id}`, distanceKm, difficulty, shape: 'loop', paceKmh: 26, riders: 3, draftPercent: 60, traffic: 'CLEAR' };
}

test('returns at most maxResults, sorted by descending score', () => {
  const catalog = [route('1', 18), route('2', 20), route('3', 16), route('4', 40)];
  const recs = recommendRoutes({ catalog, origin: ODESSA, conditions: COND, profile: PROFILE, targetDistanceKm: 18, maxResults: 3 });
  expect(recs.length).toBe(3);
  expect(recs[0].fit.score).toBeGreaterThanOrEqual(recs[1].fit.score);
  expect(recs[1].fit.score).toBeGreaterThanOrEqual(recs[2].fit.score);
});

test('generates loop fallbacks when the catalog is too small', () => {
  const recs = recommendRoutes({ catalog: [route('1', 18)], origin: ODESSA, conditions: COND, profile: PROFILE, targetDistanceKm: 18, maxResults: 3 });
  expect(recs.length).toBe(3);
  expect(recs.some((r) => r.candidate.source === 'generated')).toBe(true);
});

test('with no origin, ranks catalog only (no generated loops)', () => {
  const recs = recommendRoutes({ catalog: [route('1', 18), route('2', 20)], origin: null, conditions: COND, profile: PROFILE, targetDistanceKm: 18, maxResults: 3 });
  expect(recs.every((r) => r.candidate.source === 'catalog')).toBe(true);
  expect(recs.length).toBe(2);
});

test('empty catalog + origin still yields generated suggestions', () => {
  const recs = recommendRoutes({ catalog: [], origin: ODESSA, conditions: COND, profile: PROFILE, targetDistanceKm: 15, maxResults: 3 });
  expect(recs.length).toBe(3);
  expect(recs.every((r) => r.candidate.source === 'generated')).toBe(true);
});
