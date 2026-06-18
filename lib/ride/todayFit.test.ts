import { scoreTodayFit } from './todayFit';
import type { RouteCandidate } from './routeCandidate';
import type { Conditions } from './conditions';
import type { Profile } from '@/lib/profile';

const PROFILE: Profile = {
  id: 'u', name: 'Test', skillLevel: 'Pro', avgPaceKmh: 28,
  avatarUri: null, bike: null, weeklyRideGoal: 5, updatedAt: 0,
};

function conditions(p: Partial<Conditions> = {}): Conditions {
  return {
    windKmh: 12, windFrom: 'N', draftAdvice: '', draftIndex: 92, draftLabel: 'OPTIMAL',
    tempC: 18, feelsLikeC: 17, isRaining: false, rainMmLastHour: 0, ...p,
  };
}

function candidate(p: Partial<RouteCandidate> = {}): RouteCandidate {
  return {
    id: 'c', name: 'C', shape: 'out-and-back', distanceKm: 18, difficulty: 'MODERATE',
    paceKmh: 28, coordinates: [], origin: { latitude: 0, longitude: 0 },
    destination: { latitude: 0, longitude: 0 }, bearing: 180, source: 'catalog', ...p,
  };
}

test('tailwind route scores higher than headwind route, all else equal', () => {
  const tail = scoreTodayFit(candidate({ bearing: 180 }), { conditions: conditions(), profile: PROFILE });
  const head = scoreTodayFit(candidate({ bearing: 0 }), { conditions: conditions(), profile: PROFILE });
  expect(tail.score).toBeGreaterThan(head.score);
});

test('loop ignores wind direction (uses draftIndex strength only)', () => {
  const a = scoreTodayFit(candidate({ shape: 'loop', bearing: 0 }), { conditions: conditions(), profile: PROFILE });
  const b = scoreTodayFit(candidate({ shape: 'loop', bearing: 180 }), { conditions: conditions(), profile: PROFILE });
  expect(a.score).toBe(b.score);
});

test('difficulty far above skill lowers the score', () => {
  const easy = scoreTodayFit(candidate({ difficulty: 'MODERATE' }), { conditions: conditions(), profile: { ...PROFILE, skillLevel: 'Pro' } });
  const hard = scoreTodayFit(candidate({ difficulty: 'HARD' }), { conditions: conditions(), profile: { ...PROFILE, skillLevel: 'Novice' } });
  expect(hard.score).toBeLessThan(easy.score);
});

test('rain lowers the score and adds a weather reason', () => {
  const dry = scoreTodayFit(candidate(), { conditions: conditions({ isRaining: false }), profile: PROFILE });
  const wet = scoreTodayFit(candidate(), { conditions: conditions({ isRaining: true }), profile: PROFILE });
  expect(wet.score).toBeLessThan(dry.score);
  expect(wet.reasons.some((r) => r.kind === 'weather' && !r.good)).toBe(true);
});

test('distance close to target scores higher than far off', () => {
  const close = scoreTodayFit(candidate({ distanceKm: 20 }), { conditions: conditions(), profile: PROFILE, targetDistanceKm: 20 });
  const far = scoreTodayFit(candidate({ distanceKm: 50 }), { conditions: conditions(), profile: PROFILE, targetDistanceKm: 20 });
  expect(close.score).toBeGreaterThan(far.score);
});

test('score is clamped 0–100 and tier follows bands', () => {
  const r = scoreTodayFit(candidate(), { conditions: conditions(), profile: PROFILE });
  expect(r.score).toBeGreaterThanOrEqual(0);
  expect(r.score).toBeLessThanOrEqual(100);
  expect(['GREAT', 'GOOD', 'FAIR', 'POOR']).toContain(r.tier);
});
