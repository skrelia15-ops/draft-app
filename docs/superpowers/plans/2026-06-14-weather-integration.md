# Weather Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the synthetic `getCurrentConditions()` weather source with real weather (wind + temperature + current precipitation) for the user's location, fetched from OpenWeather through a cached Supabase Edge Function.

**Architecture:** A Deno Edge Function (`weather`) proxies OpenWeather's free Current Weather 2.5 API, caching normalized results in a `weather_cache` table for 15 minutes per ~1 km coordinate cell. The client `lib/weather/` package resolves coordinates (live GPS → last-known → Odessa), fetches via `supabase.functions.invoke`, and exposes `useWeather()`. The existing draft-index math becomes a pure `deriveConditions(weather)` fed by real wind.

**Tech Stack:** Expo/React Native, TypeScript, Supabase (Edge Functions + Postgres), OpenWeather 2.5, Jest (`jest-expo`).

---

## File Structure

Deno-safe (no path aliases, no RN deps — importable by the Edge Function):
- Create `lib/weather/types.ts` — `WeatherDTO` (primitives only), zero imports.
- Create `lib/weather/normalize.ts` — `normalizeOpenWeather(raw) → WeatherDTO`, imports only `./types`.

Client-only:
- Create `lib/weather/derive.ts` — `windFromDeg(deg)`, `toWeather(dto) → Weather`.
- Create `lib/weather/resolveCoords.ts` — `pickCoords(...)` precedence helper.
- Create `lib/weather/storage.ts` — AsyncStorage for last-known coords + last good weather.
- Create `lib/weather/api.ts` — `fetchWeather(coords) → Weather`.
- Create `lib/weather/WeatherProvider.tsx` — `WeatherProvider` + `useWeather()`.
- Create `lib/weather/index.ts` — barrel.

Modify:
- `lib/ride/conditions.ts` — add `deriveConditions(weather)`, extend `Conditions`, drop `getCurrentConditions`.
- `lib/ride/proximity.ts` — `getNearbyRiders` takes `draftLabel` param instead of calling conditions.
- `lib/ride/index.ts` — update exports.
- `app/_layout.tsx` — mount `WeatherProvider`.
- `app/(tabs)/index.tsx` — use `useWeather()` + `deriveConditions`, add temp/precip UI.
- `app/ride/route-details.tsx` — use `useWeather()` + `deriveConditions`.

Backend:
- Create `supabase/migrations/20260614010000_create_weather_cache.sql`.
- Create `supabase/functions/weather/index.ts` — Deno HTTP handler.

---

## Task 1: Weather DTO + normalize (Deno-safe, pure)

**Files:**
- Create: `lib/weather/types.ts`
- Create: `lib/weather/normalize.ts`
- Test: `lib/weather/normalize.test.ts`

- [ ] **Step 1: Create the DTO type**

`lib/weather/types.ts` (no imports — must stay Deno-safe):
```ts
/**
 * Wire contract between the `weather` Edge Function and the client.
 * Primitives only: no path aliases or RN deps, so the Deno function can
 * import this file directly.
 */
export type WeatherDTO = {
  /** Wind speed, km/h (OpenWeather m/s × 3.6, rounded). */
  windKmh: number;
  /** Wind direction OpenWeather reports it is coming FROM, degrees. */
  windDeg: number;
  /** Temperature, °C, rounded. */
  tempC: number;
  /** Feels-like temperature, °C, rounded. */
  feelsLikeC: number;
  /** True when the current condition group is wet (Rain/Drizzle/Snow/Thunderstorm). */
  isRaining: boolean;
  /** Rain volume in the last hour, mm (0 when absent). */
  rainMmLastHour: number;
  /** Epoch ms when this reading was fetched from OpenWeather. */
  observedAt: number;
};
```

- [ ] **Step 2: Write the failing test**

`lib/weather/normalize.test.ts`:
```ts
import { normalizeOpenWeather } from './normalize';

const raw = {
  wind: { speed: 5, deg: 200 },
  main: { temp: 14.6, feels_like: 12.2 },
  weather: [{ main: 'Rain', id: 500 }],
  rain: { '1h': 1.2 },
};

test('normalizeOpenWeather converts units and flags rain', () => {
  const dto = normalizeOpenWeather(raw, 1000);
  expect(dto.windKmh).toBe(18); // 5 m/s × 3.6
  expect(dto.windDeg).toBe(200);
  expect(dto.tempC).toBe(15);
  expect(dto.feelsLikeC).toBe(12);
  expect(dto.isRaining).toBe(true);
  expect(dto.rainMmLastHour).toBe(1.2);
  expect(dto.observedAt).toBe(1000);
});

test('normalizeOpenWeather treats Clear as dry with no rain volume', () => {
  const dto = normalizeOpenWeather(
    { wind: { speed: 0, deg: 0 }, main: { temp: 20, feels_like: 20 }, weather: [{ main: 'Clear', id: 800 }] },
    2000,
  );
  expect(dto.isRaining).toBe(false);
  expect(dto.rainMmLastHour).toBe(0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest lib/weather/normalize.test.ts`
Expected: FAIL — cannot find module `./normalize`.

- [ ] **Step 4: Implement normalize**

`lib/weather/normalize.ts`:
```ts
import type { WeatherDTO } from './types';

const WET_GROUPS = new Set(['Rain', 'Drizzle', 'Snow', 'Thunderstorm']);

/**
 * Convert an OpenWeather "Current Weather 2.5" payload into our DTO.
 * `observedAt` is passed in so this stays pure (no clock access).
 */
export function normalizeOpenWeather(raw: any, observedAt: number): WeatherDTO {
  const group = raw?.weather?.[0]?.main ?? 'Clear';
  return {
    windKmh: Math.round((raw?.wind?.speed ?? 0) * 3.6),
    windDeg: Math.round(raw?.wind?.deg ?? 0),
    tempC: Math.round(raw?.main?.temp ?? 0),
    feelsLikeC: Math.round(raw?.main?.feels_like ?? 0),
    isRaining: WET_GROUPS.has(group),
    rainMmLastHour: raw?.rain?.['1h'] ?? 0,
    observedAt,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest lib/weather/normalize.test.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add lib/weather/types.ts lib/weather/normalize.ts lib/weather/normalize.test.ts
git commit -m "feat(weather): DTO + OpenWeather normalizer"
```

---

## Task 2: Client wind-direction + Weather builder

**Files:**
- Create: `lib/weather/derive.ts`
- Test: `lib/weather/derive.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/weather/derive.test.ts`:
```ts
import { windFromDeg, toWeather } from './derive';
import type { WeatherDTO } from './types';

test('windFromDeg maps the 8 compass sectors', () => {
  expect(windFromDeg(0)).toBe('N');
  expect(windFromDeg(45)).toBe('NE');
  expect(windFromDeg(90)).toBe('E');
  expect(windFromDeg(180)).toBe('S');
  expect(windFromDeg(315)).toBe('NW');
  expect(windFromDeg(350)).toBe('N'); // wraps back to N
});

test('toWeather adds windFrom derived from windDeg', () => {
  const dto: WeatherDTO = {
    windKmh: 18, windDeg: 90, tempC: 15, feelsLikeC: 12,
    isRaining: false, rainMmLastHour: 0, observedAt: 1000,
  };
  expect(toWeather(dto)).toEqual({ ...dto, windFrom: 'E' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/weather/derive.test.ts`
Expected: FAIL — cannot find module `./derive`.

- [ ] **Step 3: Implement derive**

`lib/weather/derive.ts`:
```ts
import type { CompassDirection } from '@/lib/ride';
import type { WeatherDTO } from './types';

/** Client-side view of weather: DTO plus the 8-point compass label. */
export type Weather = WeatherDTO & { windFrom: CompassDirection };

const SECTORS: CompassDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Degrees (0–360, wind coming FROM) → nearest 8-point compass label. */
export function windFromDeg(deg: number): CompassDirection {
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return SECTORS[idx];
}

export function toWeather(dto: WeatherDTO): Weather {
  return { ...dto, windFrom: windFromDeg(dto.windDeg) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/weather/derive.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/weather/derive.ts lib/weather/derive.test.ts
git commit -m "feat(weather): client Weather builder + compass mapping"
```

---

## Task 3: Coordinate resolution helper

**Files:**
- Create: `lib/weather/resolveCoords.ts`
- Test: `lib/weather/resolveCoords.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/weather/resolveCoords.test.ts`:
```ts
import { pickCoords } from './resolveCoords';

const live = { latitude: 1, longitude: 1 };
const last = { latitude: 2, longitude: 2 };
const fallback = { latitude: 3, longitude: 3 };

test('prefers live coords', () => {
  expect(pickCoords(live, last, fallback)).toEqual(live);
});

test('falls back to last-known when no live fix', () => {
  expect(pickCoords(null, last, fallback)).toEqual(last);
});

test('falls back to default when nothing else', () => {
  expect(pickCoords(null, null, fallback)).toEqual(fallback);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/weather/resolveCoords.test.ts`
Expected: FAIL — cannot find module `./resolveCoords`.

- [ ] **Step 3: Implement pickCoords**

`lib/weather/resolveCoords.ts`:
```ts
import type { LatLng } from '@/lib/maps';

/** First available wins: live GPS → last-known → fallback default. */
export function pickCoords(
  live: LatLng | null,
  lastKnown: LatLng | null,
  fallback: LatLng,
): LatLng {
  return live ?? lastKnown ?? fallback;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/weather/resolveCoords.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/weather/resolveCoords.ts lib/weather/resolveCoords.test.ts
git commit -m "feat(weather): coordinate resolution precedence"
```

---

## Task 4: deriveConditions refactor + proximity decoupling

**Files:**
- Modify: `lib/ride/conditions.ts`
- Modify: `lib/ride/proximity.ts:96-137` (the `getNearbyRiders` signature + the conditions usage)
- Modify: `lib/ride/index.ts:10` (swap export)
- Test: `lib/ride/conditions.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/ride/conditions.test.ts`:
```ts
import { deriveConditions } from './conditions';
import type { Weather } from '@/lib/weather';

function weather(partial: Partial<Weather>): Weather {
  return {
    windKmh: 10, windDeg: 0, windFrom: 'N', tempC: 18, feelsLikeC: 17,
    isRaining: false, rainMmLastHour: 0, observedAt: 0, ...partial,
  };
}

test('light wind (<8) is FAIR', () => {
  const c = deriveConditions(weather({ windKmh: 5 }));
  expect(c.draftIndex).toBe(62);
  expect(c.draftLabel).toBe('FAIR');
});

test('ideal wind (8–13) is OPTIMAL', () => {
  const c = deriveConditions(weather({ windKmh: 12 }));
  expect(c.draftIndex).toBe(92);
  expect(c.draftLabel).toBe('OPTIMAL');
});

test('strong wind (>=20) is POOR', () => {
  const c = deriveConditions(weather({ windKmh: 25 }));
  expect(c.draftIndex).toBe(60);
  expect(c.draftLabel).toBe('FAIR'); // 60 → FAIR per existing thresholds
});

test('passes weather fields through', () => {
  const c = deriveConditions(weather({ tempC: 21, feelsLikeC: 19, isRaining: true, rainMmLastHour: 1.2 }));
  expect(c.tempC).toBe(21);
  expect(c.feelsLikeC).toBe(19);
  expect(c.isRaining).toBe(true);
  expect(c.rainMmLastHour).toBe(1.2);
});
```

> Note: existing thresholds map draftIndex 60 → `FAIR` (>=60), 62 → `FAIR`, 80 → `GOOD`, 92 → `OPTIMAL`. The test asserts exactly that.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/ride/conditions.test.ts`
Expected: FAIL — `deriveConditions` is not exported.

- [ ] **Step 3: Rewrite conditions.ts**

Replace the body of `lib/ride/conditions.ts` with (keep `CompassDirection`, `DIRECTIONS`, `oppositeOf`; replace clock logic with a pure function over `Weather`):
```ts
import type { Weather } from '@/lib/weather';

export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const DIRECTIONS: CompassDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export type Conditions = {
  windKmh: number;
  windFrom: CompassDirection;
  draftAdvice: string;
  draftIndex: number;
  draftLabel: 'OPTIMAL' | 'GOOD' | 'FAIR' | 'POOR';
  /** Temperature, °C. */
  tempC: number;
  /** Feels-like, °C. */
  feelsLikeC: number;
  /** Whether it is currently raining/snowing. */
  isRaining: boolean;
  /** Rain volume last hour, mm. */
  rainMmLastHour: number;
};

/** Derive drafting conditions from a real weather reading. Pure. */
export function deriveConditions(weather: Weather): Conditions {
  const { windKmh, windFrom } = weather;

  let draftIndex: number;
  if (windKmh < 8) draftIndex = 62;
  else if (windKmh < 14) draftIndex = 92;
  else if (windKmh < 20) draftIndex = 80;
  else draftIndex = 60;

  let draftLabel: Conditions['draftLabel'];
  if (draftIndex >= 90) draftLabel = 'OPTIMAL';
  else if (draftIndex >= 75) draftLabel = 'GOOD';
  else if (draftIndex >= 60) draftLabel = 'FAIR';
  else draftLabel = 'POOR';

  const draftAdvice =
    windKmh >= 14
      ? `Wind from ${windFrom} · best drafting heading ${oppositeOf(windFrom)}.`
      : 'Light wind · most directions draft well.';

  return {
    windKmh,
    windFrom,
    draftAdvice,
    draftIndex,
    draftLabel,
    tempC: weather.tempC,
    feelsLikeC: weather.feelsLikeC,
    isRaining: weather.isRaining,
    rainMmLastHour: weather.rainMmLastHour,
  };
}

function oppositeOf(d: CompassDirection): CompassDirection {
  const i = DIRECTIONS.indexOf(d);
  return DIRECTIONS[(i + 4) % DIRECTIONS.length];
}
```

- [ ] **Step 4: Decouple proximity from conditions**

In `lib/ride/proximity.ts`: remove `import { getCurrentConditions, type CompassDirection } from './conditions';` and instead `import type { CompassDirection } from './conditions';`. Change the signature and the nudge:
```ts
export function getNearbyRiders(
  coords: LatLng | null,
  userPaceKmh: number = 28,
  draftLabel: 'OPTIMAL' | 'GOOD' | 'FAIR' | 'POOR' = 'GOOD',
): NearbyRider[] {
```
Delete the line `const conditions = getCurrentConditions();`. Replace the nudge condition:
```ts
    // Conditions nudge: poor wind drops the headline rating one notch
    if (draftLabel === 'POOR' && potential === 'HIGH') {
      potential = 'MEDIUM';
    }
```

- [ ] **Step 5: Update the ride barrel**

In `lib/ride/index.ts`, replace the conditions export line:
```ts
export { deriveConditions } from './conditions';
export type { Conditions, CompassDirection } from './conditions';
```
(Remove the `getCurrentConditions` export.)

- [ ] **Step 6: Run tests + typecheck**

Run: `npx jest lib/ride/conditions.test.ts && npx tsc --noEmit`
Expected: conditions tests PASS. `tsc` will report errors in `app/(tabs)/index.tsx` and `app/ride/route-details.tsx` (they still call `getCurrentConditions`) — that is expected; those are fixed in Tasks 10–11. Note the errors and continue.

- [ ] **Step 7: Commit**

```bash
git add lib/ride/conditions.ts lib/ride/conditions.test.ts lib/ride/proximity.ts lib/ride/index.ts
git commit -m "refactor(ride): deriveConditions from real weather; decouple proximity"
```

---

## Task 5: Weather persistence (AsyncStorage)

**Files:**
- Create: `lib/weather/storage.ts`

> Thin AsyncStorage shim (mirrors `lib/profile/storage.ts`). Not unit-tested; the AsyncStorage mock returns null in tests anyway. Verified via typecheck.

- [ ] **Step 1: Implement storage**

`lib/weather/storage.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LatLng } from '@/lib/maps';
import type { Weather } from './derive';

const COORDS_KEY = '@draft/weather/last-coords/v1';
const WEATHER_KEY = '@draft/weather/last-good/v1';

export async function saveLastCoords(c: LatLng): Promise<void> {
  try { await AsyncStorage.setItem(COORDS_KEY, JSON.stringify(c)); } catch {}
}

export async function loadLastCoords(): Promise<LatLng | null> {
  try {
    const raw = await AsyncStorage.getItem(COORDS_KEY);
    return raw ? (JSON.parse(raw) as LatLng) : null;
  } catch { return null; }
}

export async function saveLastWeather(w: Weather): Promise<void> {
  try { await AsyncStorage.setItem(WEATHER_KEY, JSON.stringify(w)); } catch {}
}

export async function loadLastWeather(): Promise<Weather | null> {
  try {
    const raw = await AsyncStorage.getItem(WEATHER_KEY);
    return raw ? (JSON.parse(raw) as Weather) : null;
  } catch { return null; }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` (ignore the known Task 10–11 screen errors).
Expected: no new errors in `lib/weather/storage.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/weather/storage.ts
git commit -m "feat(weather): persist last coords + last good weather"
```

---

## Task 6: Weather API client

**Files:**
- Create: `lib/weather/api.ts`
- Test: `lib/weather/api.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/weather/api.test.ts`:
```ts
import { fetchWeather } from './api';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn().mockResolvedValue({
        data: {
          windKmh: 18, windDeg: 90, tempC: 15, feelsLikeC: 12,
          isRaining: false, rainMmLastHour: 0, observedAt: 1000,
        },
        error: null,
      }),
    },
  },
}));

test('fetchWeather invokes the function and returns a Weather with windFrom', async () => {
  const { supabase } = require('@/lib/supabase');
  const w = await fetchWeather({ latitude: 1, longitude: 2 });
  expect(supabase.functions.invoke).toHaveBeenCalledWith('weather', {
    body: { lat: 1, lng: 2 },
  });
  expect(w.windFrom).toBe('E');
  expect(w.tempC).toBe(15);
});

test('fetchWeather throws on edge error', async () => {
  const { supabase } = require('@/lib/supabase');
  supabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
  await expect(fetchWeather({ latitude: 1, longitude: 2 })).rejects.toThrow('boom');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/weather/api.test.ts`
Expected: FAIL — cannot find module `./api`.

- [ ] **Step 3: Implement api**

`lib/weather/api.ts`:
```ts
import { supabase } from '@/lib/supabase';
import type { LatLng } from '@/lib/maps';
import { toWeather, type Weather } from './derive';
import type { WeatherDTO } from './types';

/** Fetch current weather for a coordinate via the `weather` Edge Function. */
export async function fetchWeather(coords: LatLng): Promise<Weather> {
  const { data, error } = await supabase.functions.invoke('weather', {
    body: { lat: coords.latitude, lng: coords.longitude },
  });
  if (error) throw new Error(error.message);
  return toWeather(data as WeatherDTO);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/weather/api.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add lib/weather/api.ts lib/weather/api.test.ts
git commit -m "feat(weather): edge-function API client"
```

---

## Task 7: WeatherProvider + hook + barrel + mount

**Files:**
- Create: `lib/weather/WeatherProvider.tsx`
- Create: `lib/weather/index.ts`
- Modify: `app/_layout.tsx` (mount provider; import from `@/lib/weather`)

- [ ] **Step 1: Implement the provider**

`lib/weather/WeatherProvider.tsx`:
```tsx
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { useUserLocation } from '@/hooks/useUserLocation';
import { ODESSA } from '@/lib/maps';
import { fetchWeather } from './api';
import { pickCoords } from './resolveCoords';
import { loadLastCoords, saveLastCoords, loadLastWeather, saveLastWeather } from './storage';
import type { Weather } from './derive';

const REFRESH_MS = 15 * 60 * 1000;

type WeatherContextValue = {
  weather: Weather | null;
  observedAt: number | null;
  refresh: () => void;
};

const WeatherContext = createContext<WeatherContextValue | null>(null);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const { coords } = useUserLocation();
  const [lastKnown, setLastKnown] = useState<LatLngOrNull>(null);
  const [weather, setWeather] = useState<Weather | null>(null);

  // Hydrate last-known coords + last good weather once.
  useEffect(() => {
    loadLastCoords().then(setLastKnown);
    loadLastWeather().then((w) => { if (w) setWeather(w); });
  }, []);

  // Persist live coords as they arrive.
  useEffect(() => {
    if (coords) { setLastKnown(coords); saveLastCoords(coords); }
  }, [coords]);

  const target = useMemo(
    () => pickCoords(coords, lastKnown, ODESSA),
    [coords, lastKnown],
  );

  // Round the cell so tiny GPS jitter doesn't refetch.
  const cellKey = `${target.latitude.toFixed(2)},${target.longitude.toFixed(2)}`;

  const load = useCallback(async () => {
    try {
      const w = await fetchWeather(target);
      setWeather(w);
      saveLastWeather(w);
    } catch {
      // Keep the last good value; card never goes blank.
    }
  }, [target]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
    // Re-run when the rounded cell changes, not on every jitter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellKey]);

  const value = useMemo(
    () => ({ weather, observedAt: weather?.observedAt ?? null, refresh: load }),
    [weather, load],
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather(): WeatherContextValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather must be used inside <WeatherProvider>.');
  return ctx;
}

type LatLngOrNull = import('@/lib/maps').LatLng | null;
```

> Note: import React hooks as `useCallback` (lowercase) — the block above shows the names; ensure the import line reads `useCallback`, `useContext`, etc. exactly.

- [ ] **Step 2: Create the barrel**

`lib/weather/index.ts`:
```ts
export { WeatherProvider, useWeather } from './WeatherProvider';
export { deriveConditionsFromWeather } from './derive'; // see note
export { toWeather, windFromDeg } from './derive';
export type { Weather } from './derive';
export type { WeatherDTO } from './types';
```
Remove the `deriveConditionsFromWeather` line — it does not exist; the barrel should export only what exists:
```ts
export { WeatherProvider, useWeather } from './WeatherProvider';
export { toWeather, windFromDeg } from './derive';
export type { Weather } from './derive';
export type { WeatherDTO } from './types';
```

- [ ] **Step 3: Mount the provider in the root layout**

In `app/_layout.tsx`, import and wrap. Place `WeatherProvider` inside `ProfileProvider` (so it can later read profile if needed) and around the navigator. Add:
```tsx
import { WeatherProvider } from '@/lib/weather';
```
Wrap the existing tree, e.g. inside `RideProvider`:
```tsx
<WeatherProvider>
  {/* existing RootNavigator / Stack subtree */}
</WeatherProvider>
```

- [ ] **Step 4: Typecheck + run all weather tests**

Run: `npx tsc --noEmit && npx jest lib/weather`
Expected: weather tests PASS; `tsc` shows only the known Task 10–11 screen errors.

- [ ] **Step 5: Commit**

```bash
git add lib/weather/WeatherProvider.tsx lib/weather/index.ts app/_layout.tsx
git commit -m "feat(weather): provider, hook, and root mount"
```

---

## Task 8: weather_cache migration

**Files:**
- Create: `supabase/migrations/20260614010000_create_weather_cache.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Server-side weather cache. Written/read only by the `weather` Edge
-- Function via the service role; no direct client access.

create table if not exists public.weather_cache (
  cell_key   text primary key,            -- "lat2,lng2" rounded to ~1km
  payload    jsonb not null,              -- normalized WeatherDTO
  fetched_at timestamptz not null default now()
);

alter table public.weather_cache enable row level security;
-- No policies: anon/authenticated get no access. The Edge Function uses
-- the service-role key, which bypasses RLS.
```

- [ ] **Step 2: Apply locally / to project**

Run: `supabase db push` (or `supabase migration up` against the linked project).
Expected: migration applies; `weather_cache` table exists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260614010000_create_weather_cache.sql
git commit -m "feat(db): weather_cache table"
```

---

## Task 9: weather Edge Function

**Files:**
- Create: `supabase/functions/weather/index.ts`

- [ ] **Step 1: Implement the function**

`supabase/functions/weather/index.ts`:
```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { normalizeOpenWeather } from '../../../lib/weather/normalize.ts';

const FRESH_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const { lat, lng } = await req.json();
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return json({ error: 'lat/lng required' }, 400);
    }

    const cellKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Fresh cache hit?
    const { data: cached } = await admin
      .from('weather_cache')
      .select('payload, fetched_at')
      .eq('cell_key', cellKey)
      .maybeSingle();

    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < FRESH_MS) {
      return json(cached.payload, 200);
    }

    // 2. Fetch from OpenWeather.
    const key = Deno.env.get('OPENWEATHER_API_KEY')!;
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${lat}&lon=${lng}&units=metric&appid=${key}`;

    let dto;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OpenWeather ${res.status}`);
      dto = normalizeOpenWeather(await res.json(), Date.now());
    } catch (e) {
      // 3. On failure, serve stale cache if we have any.
      if (cached) return json(cached.payload, 200);
      return json({ error: String(e) }, 502);
    }

    // 4. Upsert cache and return.
    await admin.from('weather_cache').upsert({
      cell_key: cellKey,
      payload: dto,
      fetched_at: new Date().toISOString(),
    });
    return json(dto, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Verify the shared import resolves under Deno**

Run: `supabase functions serve weather --no-verify-jwt`
Expected: the function boots without import errors (confirms the relative
`../../../lib/weather/normalize.ts` import + `./types.ts` chain is Deno-safe).
Stop with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/weather/index.ts
git commit -m "feat(edge): weather function with 15-min cache + stale fallback"
```

---

## Task 10: Wire the Home hero card

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Swap the conditions source**

At the top of `HomeScreen`, replace:
```tsx
const conditions = useMemo(() => getCurrentConditions(), []);
const riders = useMemo(() => getNearbyRiders(coords), [coords]);
```
with:
```tsx
const { weather } = useWeather();
const conditions = useMemo(
  () => (weather ? deriveConditions(weather) : null),
  [weather],
);
const riders = useMemo(
  () => getNearbyRiders(coords, profile.avgPaceKmh, conditions?.draftLabel),
  [coords, profile.avgPaceKmh, conditions?.draftLabel],
);
```
Update imports: remove `getCurrentConditions`, add `deriveConditions` from `@/lib/ride` and `useWeather` from `@/lib/weather`.

- [ ] **Step 2: Guard the hero card for the null-weather moment**

`conditions` is null only for the first frame before weather loads (rare, since we hydrate last-good). Where the hero reads `conditions.draftLabel`, `conditions.draftIndex`, `conditions.windKmh`, `conditions.windFrom`, `conditions.draftAdvice`, fall back to neutral copy when null. Minimal approach — compute display values once:
```tsx
const draftLabel = conditions?.draftLabel ?? 'GOOD';
const draftIndex = conditions?.draftIndex ?? 80;
const windKmh = conditions?.windKmh ?? 0;
const windFrom = conditions?.windFrom ?? 'N';
const draftAdvice = conditions?.draftAdvice ?? 'Fetching conditions…';
```
Replace the corresponding `conditions.X` reads in the JSX with these locals.

- [ ] **Step 3: Add temperature + precipitation to the hero**

Add a stat/line using `weather`:
```tsx
{weather && (
  <Text style={styles.heroWeatherLine}>
    {weather.tempC}° · feels {weather.feelsLikeC}° ·{' '}
    {weather.isRaining ? `Rain ${weather.rainMmLastHour} mm` : 'Dry'}
  </Text>
)}
```
Add a style:
```tsx
heroWeatherLine: {
  color: colors.textOnPrimary,
  fontFamily: typography.fontFamily.semibold,
  fontSize: typography.size['2xs'],
  opacity: 0.8,
  marginBottom: spacing.xs,
},
```
Place it near the WIND stat row.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "app/(tabs)/index.tsx"`
Expected: no errors in `index.tsx` (route-details still errors until Task 11).

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat(home): real weather on the hero card"
```

---

## Task 11: Wire route-details

**Files:**
- Modify: `app/ride/route-details.tsx:5,50`

- [ ] **Step 1: Swap the conditions source**

Replace the import of `getCurrentConditions` (from `@/lib/ride`) with `deriveConditions`, and add `useWeather` from `@/lib/weather`. Replace:
```tsx
const conditions = useMemo(() => getCurrentConditions(), []);
```
with:
```tsx
const { weather } = useWeather();
const conditions = useMemo(
  () => deriveConditions(weather ?? FALLBACK_WEATHER),
  [weather],
);
```
Add a module-level neutral fallback so the screen always renders:
```tsx
const FALLBACK_WEATHER = {
  windKmh: 0, windDeg: 0, windFrom: 'N' as const, tempC: 0, feelsLikeC: 0,
  isRaining: false, rainMmLastHour: 0, observedAt: 0,
};
```

- [ ] **Step 2: Typecheck + lint + full test run**

Run: `npx tsc --noEmit && npx eslint app/ride/route-details.tsx && npm test`
Expected: `tsc` clean (all screen errors resolved), eslint clean, all Jest suites PASS.

- [ ] **Step 3: Commit**

```bash
git add app/ride/route-details.tsx
git commit -m "feat(route-details): real weather conditions"
```

---

## Task 12: Secrets, deploy, and final verification

**Files:** none (ops + verification)

- [ ] **Step 1: Set the OpenWeather secret**

Run:
```bash
supabase secrets set OPENWEATHER_API_KEY=<your-openweather-key>
```
Expected: secret stored (never committed, never in the app bundle).

- [ ] **Step 2: Deploy the function**

Run: `supabase functions deploy weather`
Expected: deploy succeeds.

- [ ] **Step 3: Smoke-test end to end**

Run the app (`npm run ios` or `npm run android`) on a device/simulator with location enabled. Confirm:
- Home hero shows real wind/temp/precip for your location.
- With location denied, the card still shows weather (Odessa fallback).

- [ ] **Step 4: Final gate**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all green.

- [ ] **Step 5: Commit any final touch-ups**

```bash
git add -A
git commit -m "chore(weather): finalize integration"
```

---

## Self-Review Notes

- **Spec coverage:** Edge Function (T8–T9), cache table (T8), `lib/weather/` package (T1–T7), `deriveConditions` refactor + proximity decoupling (T4), fallback chain (T3 + T7 + T11 fallback), UI temp/precip (T10–T11), secrets (T12), tests on pure functions (T1–T4, T6). All spec sections map to tasks.
- **Precipitation:** "is it raining now + mm", no probability — matches the free-tier decision.
- **Type consistency:** `WeatherDTO` (no windFrom) → `Weather` (adds windFrom) used consistently; `deriveConditions(weather: Weather)`; `getNearbyRiders(coords, userPaceKmh, draftLabel)` signature matches the Home call site in T10.
- **Known transient build state:** after T4, screens fail `tsc` until T10–T11 — explicitly flagged in those tasks, resolved by the end of T11.
