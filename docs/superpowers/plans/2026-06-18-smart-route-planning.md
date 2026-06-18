# Smart Route Planning (B + C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-device, weather/skill/difficulty-aware route picker to the map screen — a guided ✨ banner offering B "optimize a path to my destination" and C "recommend where to ride today" — without touching the manual FROM→TO planner.

**Architecture:** Pure scoring core in `lib/ride` (TDD): a `RouteCandidate` adapter layer unifies catalog routes / generated loops / Google directions; `scoreTodayFit` ranks any candidate 0–100 with human reasons; `recommendRoutes` builds C's candidate pool (nearby catalog + generated-loop fallback). UI lives in `components/map/SmartBanner.tsx` + `components/map/SmartPanel.tsx`, wired into `app/ride/map.tsx` as additive state. Reuses the consolidated `Chip`, `Tag`, and Explore's mini-map pattern.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, react-native-maps, Jest. Spec: `docs/superpowers/specs/2026-06-18-smart-route-planning-design.md`.

**Verification command (after every task):**
```bash
cd /Users/viola/draft-app && npx tsc --noEmit -p tsconfig.json && npx jest --silent 2>&1 | tail -5
```
Expected: tsc clean; all jest suites pass.

**Known types (confirmed in codebase, do not redefine):**
- `Profile` (`@/lib/profile`): `{ id, name, skillLevel: 'Novice'|'Pro'|'Elite', avgPaceKmh, ... }`
- `Conditions` (`@/lib/ride`): `{ windKmh, windFrom: CompassDirection, draftIndex, draftLabel, tempC, isRaining, rainMmLastHour, ... }`; `CompassDirection = 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW'`
- `CatalogRoute` (`@/lib/routes`): `{ id, name, distanceKm, difficulty: Difficulty, shape: RouteShape, paceKmh, riders, draftPercent, traffic, note? }`; `Difficulty = 'EASY'|'MODERATE'|'HARD'`
- `RouteShape` (`@/lib/ride`): `'loop'|'out-and-back'|'point-to-point'`
- `LatLng` (`@/lib/maps`): `{ latitude, longitude }`
- `RouteResult` (`@/lib/maps`): `{ coordinates: LatLng[], distanceMeters, alternativeCount, trafficLevel, ... }`
- `buildRoutePreview({ origin, shape, distanceKm, seed })` (`@/lib/ride`) → `{ origin, destination, joinPoint, coordinates, shape }`
- `hashIdSeed(id)` (`@/lib/routes`) → number

---

## Task 1: `RouteCandidate` type, bearing helper, and adapters

**Files:**
- Create: `lib/ride/routeCandidate.ts`
- Create: `lib/ride/routeCandidate.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/ride/routeCandidate.test.ts`:
```ts
import { dominantBearing, compassToBearing, catalogToCandidate, loopToCandidate } from './routeCandidate';
import type { CatalogRoute } from '@/lib/routes';

const ODESSA = { latitude: 46.4825, longitude: 30.7233 };

test('compassToBearing maps cardinal directions to degrees', () => {
  expect(compassToBearing('N')).toBe(0);
  expect(compassToBearing('E')).toBe(90);
  expect(compassToBearing('S')).toBe(180);
  expect(compassToBearing('NW')).toBe(315);
});

test('dominantBearing of a due-east leg is ~90°', () => {
  const b = dominantBearing([
    { latitude: 46.48, longitude: 30.72 },
    { latitude: 46.48, longitude: 30.80 },
  ]);
  expect(b).toBeGreaterThan(80);
  expect(b).toBeLessThan(100);
});

test('dominantBearing returns 0 for <2 points (no crash)', () => {
  expect(dominantBearing([])).toBe(0);
  expect(dominantBearing([ODESSA])).toBe(0);
});

test('catalogToCandidate carries route fields and produces coordinates', () => {
  const route: CatalogRoute = {
    id: 'r1', name: 'Seaside', distanceKm: 18, difficulty: 'MODERATE',
    shape: 'loop', paceKmh: 26, riders: 4, draftPercent: 70, traffic: 'CLEAR',
  };
  const c = catalogToCandidate(route, ODESSA);
  expect(c.id).toBe('r1');
  expect(c.name).toBe('Seaside');
  expect(c.distanceKm).toBe(18);
  expect(c.difficulty).toBe('MODERATE');
  expect(c.source).toBe('catalog');
  expect(c.coordinates.length).toBeGreaterThan(2);
});

test('loopToCandidate generates a loop candidate near origin', () => {
  const c = loopToCandidate({ origin: ODESSA, distanceKm: 12, seed: 7, difficulty: 'EASY', paceKmh: 24, id: 'gen-1', name: 'Nearby loop' });
  expect(c.source).toBe('generated');
  expect(c.shape).toBe('loop');
  expect(c.distanceKm).toBe(12);
  expect(c.coordinates.length).toBeGreaterThan(2);
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `cd /Users/viola/draft-app && npx jest routeCandidate --silent`
Expected: FAIL (module not found / exports undefined).

- [ ] **Step 3: Implement `lib/ride/routeCandidate.ts`**

```ts
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
  const b = coords[Math.floor(coords.length / 2)] ?? coords[coords.length - 1];
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
  return {
    id: opts.id, name: opts.name, shape: 'point-to-point',
    distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
    difficulty: opts.difficulty, paceKmh: opts.paceKmh,
    coordinates: coords, origin: coords[0], destination: coords[coords.length - 1],
    bearing: dominantBearing(coords), source: 'directions',
  };
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `cd /Users/viola/draft-app && npx jest routeCandidate --silent` → PASS. Then run the global verification command (tsc clean).

- [ ] **Step 5: Commit**

```bash
cd /Users/viola/draft-app && git add lib/ride/routeCandidate.ts lib/ride/routeCandidate.test.ts && git commit -m "feat(ride): RouteCandidate type + bearing helper + adapters

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `scoreTodayFit` scoring engine

**Files:**
- Create: `lib/ride/todayFit.ts`
- Create: `lib/ride/todayFit.test.ts`

Scoring model (deterministic): overall = wind·0.40 + difficulty·0.30 + distance·0.20 + weather·0.10. Tiers: ≥85 GREAT, ≥70 GOOD, ≥55 FAIR, else POOR.

- [ ] **Step 1: Write the failing test**

`lib/ride/todayFit.test.ts`:
```ts
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
  // wind FROM north → blowing toward south (bearing 180). A southbound route (bearing 180) = tailwind.
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
```

- [ ] **Step 2: Run the test, expect failure**

Run: `cd /Users/viola/draft-app && npx jest todayFit --silent` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/ride/todayFit.ts`**

```ts
import type { Profile, SkillLevel } from '@/lib/profile';
import type { Conditions } from './conditions';
import { compassToBearing, type RouteCandidate } from './routeCandidate';
import type { Difficulty } from '@/lib/routes';

export type FitReason = { kind: 'wind' | 'difficulty' | 'distance' | 'weather'; good: boolean; text: string };
export type TodayFit = { score: number; tier: 'GREAT' | 'GOOD' | 'FAIR' | 'POOR'; reasons: FitReason[] };
export type FitContext = { conditions: Conditions; profile: Profile; targetDistanceKm?: number };

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const DIFFICULTY_RANK: Record<Difficulty, number> = { EASY: 0, MODERATE: 1, HARD: 2 };
const SKILL_RANK: Record<SkillLevel, number> = { Novice: 0, Pro: 1, Elite: 2 };

/** Smallest absolute angle between two bearings, 0–180°. */
function angularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function windFactor(c: RouteCandidate, cond: Conditions): { score: number; reason: FitReason | null } {
  // Loops experience wind from every direction → direction is neutral; lean on
  // the strength-based draftIndex only.
  if (c.shape === 'loop') {
    const good = cond.draftLabel === 'OPTIMAL' || cond.draftLabel === 'GOOD';
    return {
      score: cond.draftIndex,
      reason: good ? { kind: 'wind', good: true, text: 'good drafting wind' } : null,
    };
  }
  // Wind blows TO (windFrom + 180). Tailwind when the route heads that way.
  const blowingTo = (compassToBearing(cond.windFrom) + 180) % 360;
  const diff = angularDiff(c.bearing, blowingTo); // 0 = tailwind, 180 = headwind
  const align = (90 - diff) / 90; // +1 tailwind … −1 headwind
  const score = clamp(cond.draftIndex + align * 15);
  let reason: FitReason | null = null;
  if (align > 0.4) reason = { kind: 'wind', good: true, text: 'tailwind on the way out' };
  else if (align < -0.4) reason = { kind: 'wind', good: false, text: 'headwind section' };
  return { score, reason };
}

function difficultyFactor(c: RouteCandidate, p: Profile): { score: number; reason: FitReason | null } {
  const gap = DIFFICULTY_RANK[c.difficulty] - SKILL_RANK[p.skillLevel];
  const table: Record<number, number> = { 0: 100, 1: 70, [-1]: 80, 2: 35, [-2]: 65 };
  const score = table[gap] ?? 50;
  let reason: FitReason | null = null;
  if (gap === 0) reason = { kind: 'difficulty', good: true, text: `matches your ${p.skillLevel} level` };
  else if (gap >= 1) reason = { kind: 'difficulty', good: false, text: 'a step harder than your level' };
  else reason = { kind: 'difficulty', good: true, text: 'comfortable for you' };
  return { score, reason };
}

function distanceFactor(c: RouteCandidate, target?: number): { score: number; reason: FitReason | null } {
  if (target == null || target <= 0) return { score: 70, reason: null };
  const ratio = c.distanceKm / target;
  const score = clamp(100 - Math.min(60, Math.abs(1 - ratio) * 100));
  const reason: FitReason | null = score >= 80 ? { kind: 'distance', good: true, text: 'right length for today' } : null;
  return { score, reason };
}

function weatherFactor(cond: Conditions): { score: number; reason: FitReason | null } {
  let score = 100;
  let reason: FitReason | null = null;
  if (cond.isRaining) { score = 40; reason = { kind: 'weather', good: false, text: 'rain right now' }; }
  if (cond.tempC < 2 || cond.tempC > 33) {
    score = Math.round(score * 0.6);
    if (!reason) reason = { kind: 'weather', good: false, text: cond.tempC < 2 ? 'very cold' : 'very hot' };
  }
  return { score, reason };
}

/** Score how well a candidate suits the rider right now. Pure. */
export function scoreTodayFit(candidate: RouteCandidate, ctx: FitContext): TodayFit {
  const wind = windFactor(candidate, ctx.conditions);
  const difficulty = difficultyFactor(candidate, ctx.profile);
  const distance = distanceFactor(candidate, ctx.targetDistanceKm);
  const weather = weatherFactor(ctx.conditions);

  const score = Math.round(
    wind.score * 0.4 + difficulty.score * 0.3 + distance.score * 0.2 + weather.score * 0.1,
  );
  const tier: TodayFit['tier'] = score >= 85 ? 'GREAT' : score >= 70 ? 'GOOD' : score >= 55 ? 'FAIR' : 'POOR';

  // Surface up to 3 reasons: bad ones first (they explain a lower score), then good.
  const all = [wind.reason, difficulty.reason, distance.reason, weather.reason].filter(
    (r): r is FitReason => r != null,
  );
  const reasons = [...all.filter((r) => !r.good), ...all.filter((r) => r.good)].slice(0, 3);

  return { score: clamp(score), tier, reasons };
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `cd /Users/viola/draft-app && npx jest todayFit --silent` → PASS. Then global verification (tsc clean).

- [ ] **Step 5: Commit**

```bash
cd /Users/viola/draft-app && git add lib/ride/todayFit.ts lib/ride/todayFit.test.ts && git commit -m "feat(ride): scoreTodayFit on-device route scoring engine

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `recommendRoutes` (mode C candidate pool + ranking)

**Files:**
- Create: `lib/ride/recommend.ts`
- Create: `lib/ride/recommend.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/ride/recommend.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test, expect failure**

Run: `cd /Users/viola/draft-app && npx jest recommend --silent` → FAIL.

- [ ] **Step 3: Implement `lib/ride/recommend.ts`**

```ts
import type { LatLng } from '@/lib/maps';
import type { CatalogRoute, Difficulty } from '@/lib/routes';
import type { Conditions } from './conditions';
import type { Profile } from '@/lib/profile';
import { catalogToCandidate, loopToCandidate, type RouteCandidate } from './routeCandidate';
import { scoreTodayFit, type TodayFit } from './todayFit';

export type Recommendation = { candidate: RouteCandidate; fit: TodayFit };

// Difficulty assigned to generated loops, picked to match the rider's skill so
// the fallback never feels mismatched.
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

  // 1. Catalog → candidates. Without an origin we cannot build previews, so we
  //    fall back to the route's own preview anchored at a neutral point; but
  //    bearing/coords only matter for display + non-loop wind, and catalog
  //    routes are mostly loops, so anchoring at origin (or 0,0) is acceptable.
  const anchor = origin ?? { latitude: 0, longitude: 0 };
  const catalogCands = catalog.map((r) => catalogToCandidate(r, anchor));

  // 2. Backfill with generated loops ONLY when we have a real origin.
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
```

> Note on the "no origin" test: catalog routes are passed through `catalogToCandidate` anchored at (0,0); `source` stays `'catalog'`, satisfying the assertion. The empty-catalog+origin test backfills 3 generated loops.

- [ ] **Step 4: Run the test, expect pass**

Run: `cd /Users/viola/draft-app && npx jest recommend --silent` → PASS. Then global verification.

- [ ] **Step 5: Commit**

```bash
cd /Users/viola/draft-app && git add lib/ride/recommend.ts lib/ride/recommend.test.ts && git commit -m "feat(ride): recommendRoutes — catalog + generated-loop ranking for mode C

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Export the new API from the ride barrel

**Files:**
- Modify: `lib/ride/index.ts`

- [ ] **Step 1: Add exports**

Append to `lib/ride/index.ts`:
```ts
export { scoreTodayFit } from './todayFit';
export type { TodayFit, FitReason, FitContext } from './todayFit';
export {
  dominantBearing, compassToBearing,
  catalogToCandidate, loopToCandidate, directionsToCandidate,
} from './routeCandidate';
export type { RouteCandidate } from './routeCandidate';
export { recommendRoutes } from './recommend';
export type { Recommendation } from './recommend';
```

- [ ] **Step 2: Verify & commit**

Global verification (tsc clean, jest pass). Then:
```bash
cd /Users/viola/draft-app && git add lib/ride/index.ts && git commit -m "feat(ride): export smart-route API from barrel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `SmartBanner` component

**Files:**
- Create: `components/map/SmartBanner.tsx`

- [ ] **Step 1: Implement the component**

```tsx
import { Pressable, StyleSheet, Text } from 'react-native';
import { Magnifer } from '@solar-icons/react-native/Linear';
import { colors, radius, spacing, typography } from '@/theme';

/** Floating pill above the manual sheet that opens the smart route panel. */
export function SmartBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Suggest a route for today"
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
    >
      <Text style={styles.spark}>✨</Text>
      <Text style={styles.label}>Suggest today's ride</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.primary,
    shadowColor: colors.black, shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  pressed: { opacity: 0.9 },
  spark: { fontSize: typography.size.sm },
  label: {
    color: colors.textOnDark, fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.xs, letterSpacing: typography.letterSpacing.wide,
  },
});
```
> If `Magnifer` import is unused (we used an emoji ✨), remove the icon import. Verify `@solar-icons/react-native/Linear` is how other map icons import (it is, see map.tsx).

- [ ] **Step 2: Verify & commit**

Global verification (tsc clean). Then:
```bash
cd /Users/viola/draft-app && git add components/map/SmartBanner.tsx && git commit -m "feat(map): SmartBanner pill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `SmartPanel` component (modes B/C, inputs, results)

**Files:**
- Create: `components/map/SmartPanel.tsx`

This is the heart of the UI. It is a self-contained panel that receives data + callbacks via props (the screen owns weather/profile/location and the directions call). It reuses `Chip` (`@/components/ui/draft`), `Tag` (`@/components/ui/draft`), and a small inline mini-map (mirroring Explore's `RouteMiniMap`).

- [ ] **Step 1: Implement the component**

```tsx
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { Chip, Tag } from '@/components/ui/draft';
import { darkMapStyle, MAP_PROVIDER, type LatLng } from '@/lib/maps';
import {
  recommendRoutes, scoreTodayFit, directionsToCandidate,
  type Recommendation, type RouteCandidate, type TodayFit,
} from '@/lib/ride';
import type { Conditions } from '@/lib/ride';
import type { CatalogRoute } from '@/lib/routes';
import type { Profile } from '@/lib/profile';
import { colors, radius, spacing, typography } from '@/theme';

type Mode = 'choose' | 'destination' | 'recommend';
const DURATIONS: { label: string; minutes: number | null }[] = [
  { label: '30 min', minutes: 30 }, { label: '1 hr', minutes: 60 },
  { label: '2 hr', minutes: 120 }, { label: 'Any', minutes: null },
];

export type SmartPanelProps = {
  catalog: CatalogRoute[];
  origin: LatLng | null;
  conditions: Conditions;
  profile: Profile;
  /** Mode B: resolve directions-based candidates for the typed destination. */
  destinationRecs: Recommendation[] | null;
  destinationLoading: boolean;
  onRequestDestination: () => void;   // screen opens its existing dest picker
  onStart: (candidate: RouteCandidate) => void;
  onClose: () => void;
};

export function SmartPanel(props: SmartPanelProps) {
  const { catalog, origin, conditions, profile } = props;
  const [mode, setMode] = useState<Mode>('choose');
  const [durationIdx, setDurationIdx] = useState(1); // default 1 hr

  const targetDistanceKm = useMemo(() => {
    const mins = DURATIONS[durationIdx].minutes;
    return mins == null ? undefined : Math.round((profile.avgPaceKmh * mins) / 60);
  }, [durationIdx, profile.avgPaceKmh]);

  const recommendRecs = useMemo<Recommendation[]>(() => {
    if (mode !== 'recommend') return [];
    return recommendRoutes({ catalog, origin, conditions, profile, targetDistanceKm, maxResults: 3 });
  }, [mode, catalog, origin, conditions, profile, targetDistanceKm]);

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      {mode === 'choose' && (
        <View style={styles.chooseRow}>
          <Pressable style={styles.choice} onPress={() => { setMode('destination'); props.onRequestDestination(); }}>
            <Text style={styles.choiceIcon}>📍</Text>
            <Text style={styles.choiceLabel}>I have a destination</Text>
          </Pressable>
          <Pressable style={[styles.choice, styles.choiceAccent]} onPress={() => setMode('recommend')}>
            <Text style={styles.choiceIcon}>✨</Text>
            <Text style={[styles.choiceLabel, styles.choiceLabelAccent]}>Recommend a route</Text>
          </Pressable>
        </View>
      )}

      {mode === 'recommend' && (
        <>
          <Text style={styles.label}>HOW LONG?</Text>
          <View style={styles.chipsRow}>
            {DURATIONS.map((d, i) => (
              <Chip key={d.label} label={d.label} active={i === durationIdx} onPress={() => setDurationIdx(i)} />
            ))}
          </View>
          <Text style={[styles.label, styles.spaced]}>FITS YOU TODAY</Text>
          <ResultList recs={recommendRecs} emptyHint={origin ? 'No matches — try a different duration.' : 'Turn on location for routes near you.'} onStart={props.onStart} />
        </>
      )}

      {mode === 'destination' && (
        <>
          <Text style={styles.label}>BEST PATH THERE</Text>
          {props.destinationLoading ? (
            <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Scoring routes…</Text></View>
          ) : (
            <ResultList recs={props.destinationRecs ?? []} emptyHint="Pick a destination to compare routes." onStart={props.onStart} />
          )}
        </>
      )}

      <Pressable style={styles.close} onPress={props.onClose} accessibilityRole="button">
        <Text style={styles.closeText}>{mode === 'choose' ? 'CANCEL' : 'BACK'}</Text>
      </Pressable>
    </View>
  );
}

function ResultList({ recs, emptyHint, onStart }: { recs: Recommendation[]; emptyHint: string; onStart: (c: RouteCandidate) => void }) {
  if (recs.length === 0) return <Text style={styles.emptyHint}>{emptyHint}</Text>;
  return (
    <>
      {recs.map((r, i) => <ResultCard key={r.candidate.id} rec={r} best={i === 0} onPress={() => onStart(r.candidate)} />)}
      {recs.some((r) => r.candidate.source === 'generated') && (
        <Text style={styles.genNote}>＋ generated loops near you</Text>
      )}
    </>
  );
}

function ResultCard({ rec, best, onPress }: { rec: Recommendation; best: boolean; onPress: () => void }) {
  const { candidate, fit } = rec;
  return (
    <Pressable onPress={onPress} style={[styles.card, best && styles.cardBest]} accessibilityRole="button">
      <View style={styles.miniMap}>
        <MapView
          provider={MAP_PROVIDER} style={StyleSheet.absoluteFill} customMapStyle={darkMapStyle}
          region={regionFor(candidate.coordinates)} pointerEvents="none"
          toolbarEnabled={false} showsCompass={false} showsMyLocationButton={false}
          showsPointsOfInterest={false} showsBuildings={false}
        >
          <Polyline coordinates={candidate.coordinates} strokeColor={best ? colors.primary : colors.textMuted} strokeWidth={2.5} lineCap="round" lineJoin="round" />
        </MapView>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>{candidate.name.toUpperCase()}</Text>
          <Text style={[styles.cardScore, best && styles.cardScoreBest]}>{fit.score}<Text style={styles.cardScorePct}>%</Text></Text>
        </View>
        <Text style={styles.cardMeta}>{candidate.distanceKm} km · {candidate.shape}</Text>
        <View style={styles.reasons}>
          {fit.reasons.map((reason, i) => (
            <Tag key={i} icon={<View style={[styles.reasonDot, { backgroundColor: reason.good ? colors.success : colors.warning }]} />} label={reason.text} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

function regionFor(coords: LatLng[]) {
  const lats = coords.map((c) => c.latitude), lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5), longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.5),
  };
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surfaceElevated, borderRadius: radius['2xl'], padding: spacing.md,
    shadowColor: colors.black, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.pill, backgroundColor: colors.inactiveOnDark, marginBottom: spacing.sm },
  chooseRow: { flexDirection: 'row', gap: spacing.sm },
  choice: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.hairline },
  choiceAccent: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceIcon: { fontSize: typography.size.lg },
  choiceLabel: { color: colors.textOnDark, fontFamily: typography.fontFamily.bold, fontSize: typography.size.xs },
  choiceLabelAccent: { color: colors.textOnPrimary },
  label: { color: colors.textMuted, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs, letterSpacing: typography.letterSpacing.wider, marginBottom: spacing.sm },
  spaced: { marginTop: spacing.lg },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.background, borderRadius: radius.xl, padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  cardBest: { borderColor: colors.primary },
  miniMap: { width: 64, height: 64, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.black },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardName: { flex: 1, color: colors.textOnDark, fontFamily: typography.fontFamily.extrabold, fontStyle: 'italic', fontSize: typography.size.sm },
  cardScore: { color: colors.textMuted, fontFamily: typography.fontFamily.extrabold, fontStyle: 'italic', fontSize: typography.size.lg },
  cardScoreBest: { color: colors.primary },
  cardScorePct: { fontSize: typography.size.xs },
  cardMeta: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.xs, marginTop: spacing['3xs'], marginBottom: spacing.xs },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reasonDot: { width: 8, height: 8, borderRadius: radius.pill },
  emptyHint: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.sm, textAlign: 'center', paddingVertical: spacing.md },
  genNote: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size['2xs'], textAlign: 'center', opacity: 0.7 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  loadingText: { color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.xs },
  close: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
  closeText: { color: colors.textMuted, fontFamily: typography.fontFamily.bold, fontSize: typography.size.xs, letterSpacing: typography.letterSpacing.wider },
});
```
> If `directionsToCandidate`/`scoreTodayFit` end up unused inside this file (mode B builds its recs in the screen — see Task 7), remove them from the import to satisfy `noUnusedLocals`. Confirm `radius['2xl']`, `spacing['3xs']`, `typography.letterSpacing.wider` exist (they're used elsewhere in the codebase).

- [ ] **Step 2: Verify & commit**

Global verification (tsc clean — this proves all reused components/types resolve). Then:
```bash
cd /Users/viola/draft-app && git add components/map/SmartPanel.tsx && git commit -m "feat(map): SmartPanel — guided B/C route picker UI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Wire SmartBanner + SmartPanel into the map screen

**Files:**
- Modify: `app/ride/map.tsx`

The screen already has `origin`/`destination` endpoints, `coords`, and `startRide`. Add: weather→conditions, profile, catalog, the panel open/close state, and mode-B directions scoring.

- [ ] **Step 1: Add imports + data hooks**

At the top of `app/ride/map.tsx`, add imports:
```tsx
import { SmartBanner } from '@/components/map/SmartBanner';
import { SmartPanel } from '@/components/map/SmartPanel';
import { useWeather } from '@/lib/weather';
import { useProfile } from '@/lib/profile';
import { useRoutes } from '@/lib/routes';
import {
  deriveConditions, getCyclingDirections, directionsToCandidate, scoreTodayFit,
  type Recommendation,
} from '@/lib/ride';
```
> `getCyclingDirections` is already imported from `@/lib/maps` in this file — do NOT duplicate; it is NOT in `@/lib/ride`. Keep the existing `@/lib/maps` import for it. The `@/lib/ride` import adds only `deriveConditions, directionsToCandidate, scoreTodayFit, type Recommendation`.

Inside `RideMapScreen`, after the existing hooks:
```tsx
const { weather } = useWeather();
const { profile } = useProfile();
const { routes: catalog } = useRoutes();
const conditions = useMemo(() => deriveConditions(weather ?? FALLBACK_WEATHER_SMART), [weather]);

const [smartOpen, setSmartOpen] = useState(false);
const [destRecs, setDestRecs] = useState<Recommendation[] | null>(null);
const [destLoading, setDestLoading] = useState(false);
```
Add a module-level fallback weather constant near `FALLBACK_REGION` (mirror `route-details.tsx`):
```tsx
const FALLBACK_WEATHER_SMART = {
  windKmh: 0, windDeg: 0, windFrom: 'N' as const, tempC: 0, feelsLikeC: 0,
  isRaining: false, rainMmLastHour: 0, observedAt: 0,
};
```

- [ ] **Step 2: Add the mode-B scoring effect**

When the manual destination has coords and the panel is open in destination mode, score the directions. Reuse the existing `routeState` if it already holds a `ready` route, OR fetch fresh. Simplest: derive `destRecs` from the existing `routeState` when ready:
```tsx
useEffect(() => {
  if (!smartOpen) return;
  if (routeState.kind === 'ready') {
    const cand = directionsToCandidate(routeState.route, {
      id: 'dest-best', name: destination.query || 'Your route',
      difficulty: 'MODERATE', paceKmh: profile.avgPaceKmh,
    });
    const fit = scoreTodayFit(cand, { conditions, profile });
    setDestRecs([{ candidate: cand, fit }]);
    setDestLoading(false);
  } else if (routeState.kind === 'loading') {
    setDestLoading(true);
  }
}, [smartOpen, routeState, destination.query, profile, conditions]);
```
> This reuses the manual planner's existing directions fetch (the `routeState` effect already runs when both endpoints have coords). Mode B's "request destination" simply focuses the manual destination input.

- [ ] **Step 3: Render SmartBanner + SmartPanel**

In the JSX, render the banner above the bottom sheet when the panel is closed, and the panel when open. Place them inside the root `View`, after the existing `<BottomSheet .../>`:
```tsx
{!smartOpen && !navigating && (
  <View style={[styles.smartBannerWrap, { bottom: insets.bottom + sheetHeight + spacing.md }]} pointerEvents="box-none">
    <SmartBanner onPress={() => setSmartOpen(true)} />
  </View>
)}
{smartOpen && (
  <View style={[styles.smartPanelWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]} pointerEvents="box-none">
    <SmartPanel
      catalog={catalog}
      origin={origin.coords}
      conditions={conditions}
      profile={profile}
      destinationRecs={destRecs}
      destinationLoading={destLoading}
      onRequestDestination={() => destInputRef.current?.focus()}
      onStart={(candidate) => {
        setSmartOpen(false);
        startRide({
          routeName: candidate.name,
          routeCoordinates: candidate.coordinates,
          routeDistanceMeters: candidate.distanceKm * 1000,
          origin: candidate.origin,
          destination: candidate.destination,
          fallbackPaceKmh: candidate.paceKmh,
        });
        toast.success('Ride started', { text2: `${candidate.distanceKm} km route` });
        router.push('/ride/active' as Href);
      }}
      onClose={() => setSmartOpen(false)}
    />
  </View>
)}
```
Add styles to the screen's `StyleSheet`:
```tsx
smartBannerWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
smartPanelWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg },
```
> `toast`, `startRide`, `router`, `Href`, `insets`, `sheetHeight`, `destInputRef`, `origin`, `destination`, `navigating` already exist in this screen. Confirm before use.

- [ ] **Step 4: Verify**

Global verification (tsc clean, jest pass). Manually reason through: banner shows when panel closed; tapping opens panel; choose → recommend computes from catalog/loops; choose → destination focuses the dest input and (once a route builds) shows the scored path; START launches the ride.

- [ ] **Step 5: Commit**

```bash
cd /Users/viola/draft-app && git add app/ride/map.tsx && git commit -m "feat(map): wire SmartBanner + SmartPanel into the planner

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Final verification + manual pass + push

- [ ] **Step 1:** `cd /Users/viola/draft-app && npx tsc --noEmit -p tsconfig.json` → clean.
- [ ] **Step 2:** `npx jest --silent 2>&1 | tail -6` → all suites pass (including the 3 new ones).
- [ ] **Step 3:** Manual pass on `npx expo run:ios` (dev build, not Expo Go): map screen shows the ✨ banner; tap → choose B/C; C with a duration shows ranked cards with Today Fit % + reason tags; with no GPS the C empty hint appears; B focuses the destination input and scores the built route; START launches a ride. Manual FROM→TO flow still works unchanged.
- [ ] **Step 4:** Push:
```bash
cd /Users/viola/draft-app && git push origin feature/supabase-backend-auth
```

---

## Self-review notes

- **Spec coverage:** §1 engine → T2; §2 RouteCandidate+adapters → T1; §3 recommend (hybrid catalog+generated) → T3; §4 mode B → T7 (reuses manual directions + directionsToCandidate); §5 UI (banner/panel, reuse Chip/Tag/mini-map) → T5/T6/T7; §6 empty/error states → T6 (empty hints) + T7 (fallback weather, no-GPS path); §7 tests → T1/T2/T3; §8 file structure → matches. All covered.
- **Type consistency:** `RouteCandidate`, `TodayFit`, `FitContext`, `Recommendation`, `scoreTodayFit`, `recommendRoutes`, `catalogToCandidate`/`loopToCandidate`/`directionsToCandidate`, `compassToBearing`, `dominantBearing` are used with identical signatures across tasks. `Conditions`/`Profile`/`CatalogRoute`/`RouteResult`/`LatLng` match the confirmed codebase types.
- **Reuse:** Chip/Tag from the consolidated `@/components/ui/draft`; mini-map mirrors Explore's `RouteMiniMap`; banner mirrors the existing pick-banner; panel lives in `components/map/` like the post-refactor subcomponents.
- **Risk flagged:** generated loops are schematic (not real roads) — names say "Nearby loop", and `genNote` discloses they're generated; wind direction is neutralised for loops in `windFactor`.
- **Unused-import guards:** T5 (Magnifer), T6 (directionsToCandidate/scoreTodayFit if mode B scores in the screen) call out removals to satisfy `noUnusedLocals`.
