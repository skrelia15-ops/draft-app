# Supabase Backend + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace on-device AsyncStorage with a Supabase backend and add mandatory authentication (email+password, Apple, Google) plus a step-by-step sign-up/onboarding flow.

**Architecture:** A Supabase client becomes the single source of truth. The existing narrow storage shims (`loadProfile/saveProfile`, `loadHistory/saveHistory`) keep their signatures and are rewritten internally to hit Supabase. A new `AuthProvider` owns the session; `app/_layout.tsx` gates the start route via a pure state machine. Profile/ride providers load on session change and clear on sign-out. Pure logic (row<->type mappers, the gating function) is unit-tested with Jest; UI flows are verified manually in Expo Go.

**Tech Stack:** Expo 54, React Native 0.81, expo-router 6, `@supabase/supabase-js`, `expo-apple-authentication`, `@react-native-google-signin/google-signin`, Jest + jest-expo.

**Reference (per [AGENTS.md](../../../AGENTS.md)):** verify APIs against https://docs.expo.dev/versions/v54.0.0/ and the Supabase guides:
- https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
- https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth

**Supabase project:** `draft-app`, ref `fdjeihhtciooahpteign`. All DB/storage changes go through the Supabase MCP (`apply_migration`, `execute_sql`, `get_advisors`, `generate_typescript_types`, `get_project_url`, `get_publishable_keys`).

---

## File Structure

**New files:**
- `lib/supabase/client.ts` — Supabase client + AppState auto-refresh wiring
- `lib/supabase/database.types.ts` — generated DB types (via MCP)
- `lib/supabase/index.ts` — barrel
- `lib/profile/mappers.ts` — `profiles` row <-> `Profile` (+ tests)
- `lib/ride/mappers.ts` — `rides` row <-> `RideRecord` (+ tests)
- `lib/auth/AuthProvider.tsx` — session context + sign-in methods
- `lib/auth/gating.ts` — `(session, profile) -> Route` pure function (+ tests)
- `lib/auth/index.ts` — barrel
- `app/auth/_layout.tsx`, `app/auth/choose.tsx`, `app/auth/sign-in.tsx`
- `app/auth/sign-up/_layout.tsx`, `app/auth/sign-up/email.tsx`, `app/auth/sign-up/password.tsx`, `app/auth/sign-up/confirm.tsx`, `app/auth/sign-up/check-email.tsx`
- `lib/onboarding/WizardProvider.tsx` — profile-wizard draft context
- `app/onboarding/profile/_layout.tsx`, `app/onboarding/profile/basics.tsx`, `app/onboarding/profile/bike.tsx`
- `lib/profile/avatar.ts` — avatar upload/download via Storage
- `jest.config.js`, `jest.setup.js`

**Modified files:**
- `.env`, `.gitignore`, `app.config.ts`, `package.json`
- `app/_layout.tsx` (gating + AuthProvider)
- `app/onboarding/index.tsx` (remove Skip; advance to /auth)
- `lib/profile/storage.ts`, `lib/profile/ProfileProvider.tsx`, `lib/profile/index.ts`
- `lib/ride/storage.ts`, `lib/ride/RideProvider.tsx`
- `app/(tabs)/profile.tsx` (sign-out via AuthProvider)
- `app/onboarding/profile-setup.tsx` (edit-mode avatar upload)

---

## Phase 0 — Foundation

### Task 0.1: Install dependencies

**Files:** Modify `package.json` (via installer)

- [ ] **Step 1: Install runtime + dev packages**

Run:
```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage expo-apple-authentication @react-native-google-signin/google-signin
npm i -D jest jest-expo @types/jest react-test-renderer@19.1.0
```
Expected: packages added; `@react-native-async-storage/async-storage` already present (pin stays Expo-compatible).

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add supabase, auth, and jest dependencies"
```

### Task 0.2: Configure environment + secrets

**Files:** Modify `.gitignore`, `.env`, `app.config.ts`

- [ ] **Step 1: Ignore `.env`**

Add to `.gitignore` (the file currently only ignores `.env*.local`):
```
.env
```

- [ ] **Step 2: Fetch real values via MCP and write `.env`**

Get values: MCP `get_project_url` and `get_publishable_keys` for project `fdjeihhtciooahpteign`. Use the modern publishable key (`sb_publishable_...`) where `disabled` is false. Write `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=<url from get_project_url>
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_... from get_publishable_keys>
```

- [ ] **Step 3: Surface vars through `app.config.ts`**

In `app.config.ts`, extend the `extra` block (keep existing `googleMapsApiKey`):
```ts
  extra: {
    googleMapsApiKey,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  },
```

- [ ] **Step 4: Commit (without `.env`)**

```bash
git add .gitignore app.config.ts
git commit -m "chore: wire supabase env vars through app config"
```

### Task 0.3: Jest setup

**Files:** Create `jest.config.js`, `jest.setup.js`; Modify `package.json`

- [ ] **Step 1: Create `jest.config.js`**

```js
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase/.*|@react-native-google-signin/.*))',
  ],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
};
```

- [ ] **Step 2: Create `jest.setup.js`**

```js
// Silence Expo winter runtime noise in unit tests.
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { supabaseUrl: 'http://localhost', supabasePublishableKey: 'test-key' } },
}));
```

- [ ] **Step 3: Add test script to `package.json`**

In `"scripts"`, add:
```json
    "test": "jest"
```

- [ ] **Step 4: Verify Jest runs (no tests yet)**

Run: `npm test -- --passWithNoTests`
Expected: PASS, "No tests found, exiting with code 0" is acceptable with the flag.

- [ ] **Step 5: Commit**

```bash
git add jest.config.js jest.setup.js package.json
git commit -m "chore: add jest + jest-expo test harness"
```

---

## Phase 1 — Database (via Supabase MCP)

### Task 1.1: Schema + RLS + trigger migration

**Files:** none local (applied via MCP `apply_migration`)

- [ ] **Step 1: Apply the migration**

MCP `apply_migration`, name `init_profiles_and_rides`, SQL:
```sql
-- profiles: one row per auth user
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  skill_level text not null default 'Pro' check (skill_level in ('Novice','Pro','Elite')),
  avg_pace_kmh int not null default 28,
  avatar_url text,
  bike jsonb,
  weekly_ride_goal int not null default 5 check (weekly_ride_goal between 1 and 14),
  updated_at timestamptz not null default now()
);

-- rides: one row per finished ride
create table public.rides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_sec int not null,
  distance_meters double precision not null,
  avg_speed_kmh double precision not null,
  max_speed_kmh double precision not null,
  drafting_fraction double precision not null,
  energy_saved_percent double precision not null,
  energy_saved_watts double precision not null,
  potential_extra_energy_percent double precision not null,
  route_name text,
  origin jsonb,
  destination jsonb,
  samples jsonb not null default '[]'::jsonb,
  segments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index rides_user_ended_idx on public.rides (user_id, ended_at desc);

-- RLS
alter table public.profiles enable row level security;
alter table public.rides enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

create policy "rides_select_own" on public.rides for select using (auth.uid() = user_id);
create policy "rides_insert_own" on public.rides for insert with check (auth.uid() = user_id);
create policy "rides_update_own" on public.rides for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "rides_delete_own" on public.rides for delete using (auth.uid() = user_id);

-- Auto-create an empty profile row when a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Verify tables exist**

MCP `list_tables` (schemas `["public"]`). Expected: `profiles` and `rides` present.

- [ ] **Step 3: Check advisors**

MCP `get_advisors` type `security`. Expected: no "RLS disabled" or "policy missing" findings for the new tables. Fix any finding before continuing.

### Task 1.2: Avatars storage bucket

**Files:** none local (via MCP `execute_sql`)

- [ ] **Step 1: Create private bucket + owner-only policies**

MCP `execute_sql`:
```sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "avatars_read_own" on storage.objects for select
  using (bucket_id = 'avatars' and owner = auth.uid());
create policy "avatars_insert_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and owner = auth.uid());
create policy "avatars_update_own" on storage.objects for update
  using (bucket_id = 'avatars' and owner = auth.uid());
create policy "avatars_delete_own" on storage.objects for delete
  using (bucket_id = 'avatars' and owner = auth.uid());
```

- [ ] **Step 2: Verify**

MCP `execute_sql`: `select id, public from storage.buckets where id = 'avatars';`
Expected: one row, `public = false`.

### Task 1.3: Generate DB types

**Files:** Create `lib/supabase/database.types.ts`

- [ ] **Step 1: Generate**

MCP `generate_typescript_types` for the project; write the output verbatim to `lib/supabase/database.types.ts`.

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/database.types.ts
git commit -m "feat: add generated supabase database types"
```

---

## Phase 2 — Supabase client

### Task 2.1: Client module

**Files:** Create `lib/supabase/client.ts`, `lib/supabase/index.ts`

- [ ] **Step 1: Write the client**

`lib/supabase/client.ts`:
```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = extra.supabaseUrl as string;
const supabaseKey = extra.supabasePublishableKey as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase env vars. Check .env and app.config.ts.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auto-refresh only while the app is foregrounded (per Supabase RN guide).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

- [ ] **Step 2: Ensure polyfill present**

Run: `npx expo install react-native-url-polyfill`

- [ ] **Step 3: Barrel**

`lib/supabase/index.ts`:
```ts
export { supabase } from './client';
export type { Database } from './database.types';
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `lib/supabase`.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase package.json package-lock.json
git commit -m "feat: add supabase client"
```

---

## Phase 3 — Pure logic (TDD)

### Task 3.1: Profile row <-> type mappers

**Files:** Create `lib/profile/mappers.ts`, `lib/profile/mappers.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/profile/mappers.test.ts`:
```ts
import { rowToProfile, profileToRow } from './mappers';
import { DEFAULT_PROFILE } from './types';

const row = {
  id: 'user-1',
  name: 'Sam Rider',
  skill_level: 'Elite' as const,
  avg_pace_kmh: 31,
  avatar_url: null,
  bike: { name: 'Tarmac', type: 'Road' as const, weightKg: 7.1 },
  weekly_ride_goal: 6,
  updated_at: '2026-06-06T00:00:00.000Z',
};

test('rowToProfile maps snake_case row to camelCase Profile', () => {
  const p = rowToProfile(row);
  expect(p.id).toBe('user-1');
  expect(p.name).toBe('Sam Rider');
  expect(p.skillLevel).toBe('Elite');
  expect(p.avgPaceKmh).toBe(31);
  expect(p.avatarUri).toBeNull();
  expect(p.bike).toEqual({ name: 'Tarmac', type: 'Road', weightKg: 7.1 });
  expect(p.weeklyRideGoal).toBe(6);
  expect(p.updatedAt).toBe(Date.parse('2026-06-06T00:00:00.000Z'));
});

test('rowToProfile handles null bike', () => {
  expect(rowToProfile({ ...row, bike: null }).bike).toBeNull();
});

test('profileToRow maps Profile to an update payload (no id/updated_at)', () => {
  const payload = profileToRow({ ...DEFAULT_PROFILE, id: 'user-1', name: 'A' });
  expect(payload).toEqual({
    name: 'A',
    skill_level: DEFAULT_PROFILE.skillLevel,
    avg_pace_kmh: DEFAULT_PROFILE.avgPaceKmh,
    avatar_url: DEFAULT_PROFILE.avatarUri,
    bike: DEFAULT_PROFILE.bike,
    weekly_ride_goal: DEFAULT_PROFILE.weeklyRideGoal,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/profile/mappers.test.ts`
Expected: FAIL ("Cannot find module './mappers'").

- [ ] **Step 3: Implement the mappers**

`lib/profile/mappers.ts`:
```ts
import type { Bike, Profile, SkillLevel } from './types';

export type ProfileRow = {
  id: string;
  name: string;
  skill_level: SkillLevel;
  avg_pace_kmh: number;
  avatar_url: string | null;
  bike: Bike | null;
  weekly_ride_goal: number;
  updated_at: string;
};

export function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    skillLevel: row.skill_level,
    avgPaceKmh: row.avg_pace_kmh,
    avatarUri: row.avatar_url,
    bike: row.bike,
    weeklyRideGoal: row.weekly_ride_goal,
    updatedAt: Date.parse(row.updated_at),
  };
}

/** Columns the client is allowed to write (id is the PK, updated_at is server-set here). */
export type ProfileUpdate = Omit<ProfileRow, 'id' | 'updated_at'>;

export function profileToRow(p: Profile): ProfileUpdate {
  return {
    name: p.name,
    skill_level: p.skillLevel,
    avg_pace_kmh: p.avgPaceKmh,
    avatar_url: p.avatarUri,
    bike: p.bike,
    weekly_ride_goal: p.weeklyRideGoal,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/profile/mappers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/profile/mappers.ts lib/profile/mappers.test.ts
git commit -m "feat: add profile row<->type mappers with tests"
```

### Task 3.2: Ride row <-> type mappers

**Files:** Create `lib/ride/mappers.ts`, `lib/ride/mappers.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/ride/mappers.test.ts`:
```ts
import { rowToRide, rideToRow } from './mappers';
import type { RideRecord } from './types';

const ride: RideRecord = {
  id: 'ride-1',
  startedAt: 1000,
  endedAt: 5000,
  durationSec: 4,
  distanceMeters: 1200,
  avgSpeedKmh: 30,
  maxSpeedKmh: 42,
  samples: [{ t: 0, capturedAt: 1000, latitude: 1, longitude: 2, speedMs: 5, drafting: false }],
  segments: [{ index: 0, startKm: 0, endKm: 1, avgSpeedKmh: 30, drafting: false, draftEfficiency: 0, label: 'x' }],
  draftingFraction: 0.4,
  energySavedPercent: 12,
  energySavedWatts: 30,
  potentialExtraEnergyPercent: 8,
  routeName: 'Loop',
  origin: { latitude: 1, longitude: 2 },
  destination: { latitude: 3, longitude: 4 },
};

test('rideToRow then rowToRide round-trips the record', () => {
  const row = rideToRow(ride, 'user-1');
  expect(row.user_id).toBe('user-1');
  expect(row.id).toBe('ride-1');
  expect(row.distance_meters).toBe(1200);
  const back = rowToRide(row);
  expect(back).toEqual(ride);
});

test('rowToRide tolerates missing optional route fields', () => {
  const row = rideToRow({ ...ride, routeName: undefined, origin: undefined, destination: undefined }, 'u');
  const back = rowToRide(row);
  expect(back.routeName).toBeUndefined();
  expect(back.origin).toBeUndefined();
  expect(back.destination).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/ride/mappers.test.ts`
Expected: FAIL ("Cannot find module './mappers'").

- [ ] **Step 3: Implement the mappers**

`lib/ride/mappers.ts`:
```ts
import type { LatLng } from '@/lib/maps';
import type { RideRecord, RideSample, RideSegment } from './types';

export type RideRow = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_sec: number;
  distance_meters: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  drafting_fraction: number;
  energy_saved_percent: number;
  energy_saved_watts: number;
  potential_extra_energy_percent: number;
  route_name: string | null;
  origin: LatLng | null;
  destination: LatLng | null;
  samples: RideSample[];
  segments: RideSegment[];
};

export function rideToRow(r: RideRecord, userId: string): RideRow {
  return {
    id: r.id,
    user_id: userId,
    started_at: new Date(r.startedAt).toISOString(),
    ended_at: new Date(r.endedAt).toISOString(),
    duration_sec: r.durationSec,
    distance_meters: r.distanceMeters,
    avg_speed_kmh: r.avgSpeedKmh,
    max_speed_kmh: r.maxSpeedKmh,
    drafting_fraction: r.draftingFraction,
    energy_saved_percent: r.energySavedPercent,
    energy_saved_watts: r.energySavedWatts,
    potential_extra_energy_percent: r.potentialExtraEnergyPercent,
    route_name: r.routeName ?? null,
    origin: r.origin ?? null,
    destination: r.destination ?? null,
    samples: r.samples,
    segments: r.segments,
  };
}

export function rowToRide(row: RideRow): RideRecord {
  const record: RideRecord = {
    id: row.id,
    startedAt: Date.parse(row.started_at),
    endedAt: Date.parse(row.ended_at),
    durationSec: row.duration_sec,
    distanceMeters: row.distance_meters,
    avgSpeedKmh: row.avg_speed_kmh,
    maxSpeedKmh: row.max_speed_kmh,
    samples: row.samples ?? [],
    segments: row.segments ?? [],
    draftingFraction: row.drafting_fraction,
    energySavedPercent: row.energy_saved_percent,
    energySavedWatts: row.energy_saved_watts,
    potentialExtraEnergyPercent: row.potential_extra_energy_percent,
  };
  if (row.route_name != null) record.routeName = row.route_name;
  if (row.origin != null) record.origin = row.origin;
  if (row.destination != null) record.destination = row.destination;
  return record;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/ride/mappers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ride/mappers.ts lib/ride/mappers.test.ts
git commit -m "feat: add ride row<->type mappers with tests"
```

### Task 3.3: Launch-gating state machine

**Files:** Create `lib/auth/gating.ts`, `lib/auth/gating.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/auth/gating.test.ts`:
```ts
import { resolveRoute } from './gating';
import { DEFAULT_PROFILE } from '@/lib/profile';

test('no session -> auth', () => {
  expect(resolveRoute({ hasSession: false, profile: null })).toBe('/auth');
});

test('session but no profile loaded yet -> null (wait)', () => {
  expect(resolveRoute({ hasSession: true, profile: null })).toBeNull();
});

test('session + empty-name profile -> profile wizard', () => {
  expect(resolveRoute({ hasSession: true, profile: { ...DEFAULT_PROFILE, name: '' } }))
    .toBe('/onboarding/profile/basics');
});

test('session + named profile -> tabs', () => {
  expect(resolveRoute({ hasSession: true, profile: { ...DEFAULT_PROFILE, name: 'Sam' } }))
    .toBe('/(tabs)');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/auth/gating.test.ts`
Expected: FAIL ("Cannot find module './gating'").

- [ ] **Step 3: Implement**

`lib/auth/gating.ts`:
```ts
import type { Profile } from '@/lib/profile';

export type GateInput = { hasSession: boolean; profile: Profile | null };
export type Route = '/auth' | '/onboarding/profile/basics' | '/(tabs)';

/**
 * Pure decision for the start route. Returns null when we must wait
 * (logged in but the profile row hasn't loaded yet) so the caller can
 * keep the splash up instead of flashing the wrong screen.
 */
export function resolveRoute(input: GateInput): Route | null {
  if (!input.hasSession) return '/auth';
  if (input.profile == null) return null;
  if (input.profile.name.trim().length === 0) return '/onboarding/profile/basics';
  return '/(tabs)';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/auth/gating.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/gating.ts lib/auth/gating.test.ts
git commit -m "feat: add launch-gating state machine with tests"
```

---

## Phase 4 — Auth provider

### Task 4.1: AuthProvider + barrel

**Files:** Create `lib/auth/AuthProvider.tsx`, `lib/auth/index.ts`

- [ ] **Step 1: Write the provider**

`lib/auth/AuthProvider.tsx`:
```tsx
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInWithApple = useCallback(async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('No Apple identity token');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken;
    if (!idToken) throw new Error('No Google id token');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Configure Google client IDs once. Real IDs are added later (see plan notes).
  useEffect(() => {
    GoogleSignin.configure({
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    isLoading,
    signUpWithEmail,
    signInWithEmail,
    signInWithApple: Platform.OS === 'ios' ? signInWithApple : async () => { throw new Error('Apple Sign In is iOS-only'); },
    signInWithGoogle,
    signOut,
  }), [session, isLoading, signUpWithEmail, signInWithEmail, signInWithApple, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
```

- [ ] **Step 2: Barrel**

`lib/auth/index.ts`:
```ts
export { AuthProvider, useAuth } from './AuthProvider';
export { resolveRoute } from './gating';
export type { Route, GateInput } from './gating';
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `lib/auth`.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/AuthProvider.tsx lib/auth/index.ts
git commit -m "feat: add auth provider with email/apple/google sign-in"
```

---

## Phase 5 — Storage shim rewrites

### Task 5.1: Rewrite profile storage

**Files:** Modify `lib/profile/storage.ts`, `lib/profile/index.ts`

- [ ] **Step 1: Rewrite `lib/profile/storage.ts` internals (keep signatures)**

Replace the file with:
```ts
/**
 * Profile persistence. Backed by the Supabase `profiles` table; the row
 * is auto-created by a DB trigger on sign-up, so loadProfile reads it and
 * saveProfile updates it. Signatures are unchanged from the AsyncStorage
 * version so callers don't need to change.
 */
import { supabase } from '@/lib/supabase';
import { rowToProfile, profileToRow, type ProfileRow } from './mappers';
import { DEFAULT_PROFILE, type Profile } from './types';

export async function loadProfile(): Promise<Profile> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return DEFAULT_PROFILE;
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', uid).single();
  if (error || !data) return { ...DEFAULT_PROFILE, id: uid };
  return rowToProfile(data as ProfileRow);
}

export async function saveProfile(profile: Profile): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from('profiles')
    .update({ ...profileToRow(profile), updated_at: new Date().toISOString() })
    .eq('id', uid);
  if (error && __DEV__) console.warn('[profile/storage] saveProfile failed', error);
}

/** Local-only reset used on sign-out; the cloud row stays intact. */
export async function clearProfile(): Promise<void> {
  // No-op for cloud storage: sign-out clears the session, and the next
  // user's data loads on their session. Kept for API compatibility.
}
```

- [ ] **Step 2: Keep barrel export of mappers (optional types)**

In `lib/profile/index.ts`, add after existing exports:
```ts
export { rowToProfile, profileToRow } from './mappers';
export type { ProfileRow, ProfileUpdate } from './mappers';
```

- [ ] **Step 3: Typecheck + run all tests**

Run: `npx tsc --noEmit && npm test`
Expected: typecheck clean; mapper/gating tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/profile/storage.ts lib/profile/index.ts
git commit -m "feat: back profile storage with supabase"
```

### Task 5.2: Rewrite ride storage

**Files:** Modify `lib/ride/storage.ts`

- [ ] **Step 1: Rewrite `lib/ride/storage.ts` (keep `loadHistory/saveHistory/clearHistory`)**

```ts
/**
 * Ride history persistence, backed by the Supabase `rides` table.
 * saveHistory upserts the full set the provider holds; loadHistory pulls
 * the signed-in user's rides newest-first. Trace downsampling is retained
 * to keep row size sane.
 */
import { supabase } from '@/lib/supabase';
import { downsample, MAX_PERSISTED_SAMPLES } from './telemetry';
import { rideToRow, rowToRide, type RideRow } from './mappers';
import type { RideRecord } from './types';

export async function loadHistory(): Promise<RideRecord[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('rides').select('*').eq('user_id', uid).order('ended_at', { ascending: false });
  if (error || !data) return [];
  return (data as RideRow[]).map(rowToRide);
}

export async function saveHistory(history: RideRecord[]): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  const rows = history.map((r) =>
    rideToRow({ ...r, samples: downsample(r.samples, MAX_PERSISTED_SAMPLES) }, uid),
  );
  const { error } = await supabase.from('rides').upsert(rows, { onConflict: 'id' });
  if (error && __DEV__) console.warn('[ride/storage] saveHistory failed', error);
}

export async function clearHistory(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  await supabase.from('rides').delete().eq('user_id', uid);
}
```

- [ ] **Step 2: Remove the 12-ride cap in the provider**

In `lib/ride/RideProvider.tsx`, in `finishRide`, change:
```ts
      const next = [record, ...prev].slice(0, 12);
```
to:
```ts
      const next = [record, ...prev];
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/ride/storage.ts lib/ride/RideProvider.tsx
git commit -m "feat: back ride history with supabase; drop local 12-ride cap"
```

### Task 5.3: Reload providers on session change

**Files:** Modify `lib/profile/ProfileProvider.tsx`, `lib/ride/RideProvider.tsx`

- [ ] **Step 1: Reload profile when the session user changes**

In `lib/profile/ProfileProvider.tsx`, replace the bootstrap `useEffect` with a session-aware one:
```tsx
import { supabase } from '@/lib/supabase';
// ...
  useEffect(() => {
    const sync = () => {
      loadProfile().then((p) => {
        setProfile(p);
        setIsHydrated(true);
      });
    };
    sync();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setIsHydrated(false);
      setProfile(DEFAULT_PROFILE);
      sync();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
```

- [ ] **Step 2: Reload ride history on session change**

In `lib/ride/RideProvider.tsx`, replace the bootstrap effect:
```tsx
  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);
```
with:
```tsx
  useEffect(() => {
    loadHistory().then(setHistory);
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadHistory().then(setHistory);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
```
Add the import at the top: `import { supabase } from '@/lib/supabase';`

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/profile/ProfileProvider.tsx lib/ride/RideProvider.tsx
git commit -m "feat: reload profile and ride history on auth state change"
```

---

## Phase 6 — Routing & gating integration

### Task 6.1: Wrap app in AuthProvider + gate start route

**Files:** Modify `app/_layout.tsx`

- [ ] **Step 1: Add AuthProvider + a gate component**

Edit `app/_layout.tsx`. Remove `export const unstable_settings = { initialRouteName: 'onboarding' };`. Wrap providers with `AuthProvider` (outermost) and add a `<Gate />` that redirects. Replace the render body:
```tsx
import { Redirect, Stack } from 'expo-router';
import { AuthProvider, useAuth, resolveRoute } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
// ...keep existing font / splash logic...

function RootStack() {
  const { isLoading, session } = useAuth();
  const { profile, isHydrated } = useProfile();
  const route = resolveRoute({ hasSession: !!session, profile: isHydrated ? profile : null });

  // Keep splash until we know where to send the user.
  if (isLoading || (session && !isHydrated)) return null;

  return (
    <>
      {route && <Redirect href={route} />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ride" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="goals" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // ...existing useFonts + splash gating, return null until loaded...
  return (
    <AuthProvider>
      <ProfileProvider>
        <RideProvider>
          <RootStack />
          <StatusBar style="light" />
          <Toast config={toastConfig} />
        </RideProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
```
> Note: the slides at `app/onboarding/index.tsx` are reachable as the first unauthenticated screen; `resolveRoute` returns `/auth` when there's no session, but the slides intro precedes auth. Implement by having the slides screen be the no-session landing and its final action navigate to `/auth/choose` (see Task 7.3). To avoid redirect fighting the slides, only redirect to `/auth` from places other than `onboarding`; simplest: let `/auth` route group's `index` render the choose screen, and have onboarding slides `router.replace('/auth/choose')` on finish. Keep the `<Redirect>` for the authenticated cases (`/(tabs)`, `/onboarding/profile/basics`) and for hard "no session on a protected screen" by checking the current segment.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: gate start route on auth + profile state"
```

---

## Phase 7 — Auth & onboarding screens

> All screens reuse existing design-system components from `@/components/ui/draft` (`PrimaryButton`, `InputField`, `IconButton`) and `@/theme` tokens, matching the look of [profile-setup.tsx](../../../app/onboarding/profile-setup.tsx). Each screen has exactly one primary action ("one screen, one action").

### Task 7.1: Auth stack layout + choose screen

**Files:** Create `app/auth/_layout.tsx`, `app/auth/choose.tsx`

- [ ] **Step 1: Layout**

`app/auth/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Choose screen (entry of the auth group)**

`app/auth/choose.tsx`: render two primary actions — "Create account" -> `router.push('/auth/sign-up/email')`, "I already have an account" -> `router.push('/auth/sign-in')`, plus Apple (iOS only) and Google buttons calling `useAuth().signInWithApple()/signInWithGoogle()` wrapped in try/catch with `toast.error(e.message)`. Use `AppleAuthentication.AppleAuthenticationButton` on iOS. Example body:
```tsx
import { View, Text, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { PrimaryButton } from '@/components/ui/draft';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { colors, spacing, typography } from '@/theme';

export default function ChooseScreen() {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const social = async (fn: () => Promise<void>) => {
    try { await fn(); } catch (e: any) { toast.error('Sign in failed', { text2: e?.message }); }
  };
  return (
    <View style={styles.c}>
      <Text style={styles.title} allowFontScaling={false}>Welcome to DRAFT</Text>
      <PrimaryButton label="CREATE ACCOUNT" onPress={() => router.push('/auth/sign-up/email')} />
      <PrimaryButton label="I HAVE AN ACCOUNT" variant="secondary" onPress={() => router.push('/auth/sign-in')} />
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={{ height: 52 }}
          onPress={() => social(signInWithApple)}
        />
      )}
      <PrimaryButton label="CONTINUE WITH GOOGLE" variant="secondary" onPress={() => social(signInWithGoogle)} />
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  title: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.display, color: colors.textOnDark, marginBottom: spacing.lg },
});
```
> If `PrimaryButton` has no `variant` prop, check its props in `components/ui/draft` and use the available styling; do not invent props.

- [ ] **Step 3: Manual check**

Run: `npx expo start`, open in Expo Go. Expected: choose screen renders with all buttons; navigation to sign-in / sign-up works.

- [ ] **Step 4: Commit**

```bash
git add app/auth/_layout.tsx app/auth/choose.tsx
git commit -m "feat: add auth choose screen"
```

### Task 7.2: Sign-in screen

**Files:** Create `app/auth/sign-in.tsx`

- [ ] **Step 1: Build the screen**

Two `InputField`s (email, password) + `PrimaryButton` "LOG IN" calling `signInWithEmail`. On error, `toast.error`. On success, the auth state change + gate route the user automatically. Validate non-empty email/password before submit. Reuse styling from profile-setup. Include a "Forgot password?" link that calls `supabase.auth.resetPasswordForEmail(email)` and toasts confirmation (optional, low-risk).

- [ ] **Step 2: Manual check**

Sign in with a known account (create one in Step of Task 9.1 first if needed). Expected: lands in app or profile wizard.

- [ ] **Step 3: Commit**

```bash
git add app/auth/sign-in.tsx
git commit -m "feat: add email sign-in screen"
```

### Task 7.3: Sign-up wizard (email -> password -> confirm -> check-email)

**Files:** Create `app/auth/sign-up/_layout.tsx`, `email.tsx`, `password.tsx`, `confirm.tsx`, `check-email.tsx`; Modify `app/onboarding/index.tsx`

- [ ] **Step 1: Sign-up layout passing data via route params**

`app/auth/sign-up/_layout.tsx`: a `Stack` with `headerShown: false`. The flow carries `email`/`password` forward through `router.push({ pathname, params })` (params are strings, fine for this transient flow).

- [ ] **Step 2: `email.tsx`** — one `InputField` (email, `keyboardType="email-address"`, `autoCapitalize="none"`), validate format, `PrimaryButton` "NEXT" -> `router.push({ pathname: '/auth/sign-up/password', params: { email } })`.

- [ ] **Step 3: `password.tsx`** — one secure `InputField`, require length >= 6, "NEXT" -> push `/auth/sign-up/confirm` with `{ email, password }`.

- [ ] **Step 4: `confirm.tsx`** — one secure `InputField`; require it equals `password` param; "CREATE ACCOUNT" calls `useAuth().signUpWithEmail(email, password)` in try/catch (toast on error), then `router.replace('/auth/sign-up/check-email')`.

- [ ] **Step 5: `check-email.tsx`** — informational screen: "Check your inbox to confirm <email>, then log in." One `PrimaryButton` "BACK TO LOGIN" -> `router.replace('/auth/sign-in')`.

- [ ] **Step 6: Repoint onboarding slides at auth; remove Skip**

In `app/onboarding/index.tsx`: change `handleNext`'s final branch from `router.push('/onboarding/profile-setup')` to `router.replace('/auth/choose')`. Delete the `handleSkip` function and the Skip `Pressable` (and its styles `skipHitArea`/`skipText`).

- [ ] **Step 7: Manual check**

Walk: slides -> finish -> choose -> create account -> email -> password -> confirm -> check-email. Expected: no crashes; a new user appears (verify in Task 9.1).

- [ ] **Step 8: Commit**

```bash
git add app/auth/sign-up app/onboarding/index.tsx
git commit -m "feat: add step-by-step email sign-up wizard; route slides to auth"
```

### Task 7.4: Profile wizard (basics -> bike)

**Files:** Create `lib/onboarding/WizardProvider.tsx`, `app/onboarding/profile/_layout.tsx`, `basics.tsx`, `bike.tsx`

- [ ] **Step 1: Wizard draft context**

`lib/onboarding/WizardProvider.tsx`: holds a partial profile draft (`name`, `skillLevel`, `bike`) with `setDraft(patch)` and a `commit()` that calls `useProfile().update(draft)` and returns the saved profile. Keep it tiny.

- [ ] **Step 2: `app/onboarding/profile/_layout.tsx`** — wraps the two steps in `WizardProvider` and a `Stack`.

- [ ] **Step 3: `basics.tsx`** — `InputField` for name + a 3-way selector for skill level (`Novice/Pro/Elite`, reuse the chip pattern from profile-setup). "NEXT" requires non-empty name; stores into draft; `router.push('/onboarding/profile/bike')`.

- [ ] **Step 4: `bike.tsx`** — optional bike fields (name, type chips `Road/Gravel/MTB/Hybrid`, weight). Two actions: "SKIP" (commit draft without bike) and "FINISH" (commit draft with bike). Both call `commit()` then `router.replace('/(tabs)')`. The gate then keeps the user in tabs since `name` is now set.

- [ ] **Step 5: Manual check**

After confirming a test email account and signing in, expect to land on `basics`; complete -> bike -> land in tabs; verify the profile row updated (Task 9.1).

- [ ] **Step 6: Commit**

```bash
git add lib/onboarding/WizardProvider.tsx app/onboarding/profile
git commit -m "feat: add step-by-step profile setup wizard"
```

### Task 7.5: Sign-out via AuthProvider

**Files:** Modify `app/(tabs)/profile.tsx`

- [ ] **Step 1: Replace local-clear logout with real sign-out**

In `app/(tabs)/profile.tsx`, replace the `handleLogout` `onPress` body. Remove the `clearProfile`/`clearHistory`/`update(DEFAULT_PROFILE)`/`router.replace('/onboarding')` sequence with:
```tsx
import { useAuth } from '@/lib/auth';
// inside component:
const { signOut } = useAuth();
// in the Alert's destructive onPress:
          onPress: async () => {
            await signOut();
            toast.success('Logged out');
            // Gate redirects to /auth automatically on session change.
          },
```
Update the alert copy to remove "(Cloud sync is not enabled yet.)" — it now syncs. Drop now-unused imports (`clearProfile`, `clearHistory`, `DEFAULT_PROFILE`) if no longer referenced.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no unused-import errors).

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "feat: sign out via supabase from profile tab"
```

---

## Phase 8 — Avatar storage

### Task 8.1: Avatar upload/download helper

**Files:** Create `lib/profile/avatar.ts`

- [ ] **Step 1: Implement upload + signed URL**

`lib/profile/avatar.ts`:
```ts
import { supabase } from '@/lib/supabase';

/** Uploads a local image URI to the user's avatars folder; returns the storage path. */
export async function uploadAvatar(localUri: string): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const res = await fetch(localUri);
  const arrayBuffer = await res.arrayBuffer();
  const path = `${uid}/avatar.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) { if (__DEV__) console.warn('[avatar] upload failed', error); return null; }
  return path;
}

/** Resolves a storage path to a temporary signed URL for display. */
export async function avatarSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
```

- [ ] **Step 2: Wire into profile edit screen**

In `app/onboarding/profile-setup.tsx`, after `ImagePicker` returns a local URI in edit mode, on submit call `uploadAvatar(localUri)` and store the returned **path** in `avatarUri` (so `saveProfile` persists `avatar_url`). When rendering an avatar that is a storage path (not a `file://`/`http`), resolve it via `avatarSignedUrl`. Keep the local URI for immediate preview.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual check**

In edit mode, pick a photo, save. Verify in Supabase Storage an object `<uid>/avatar.jpg` exists (MCP `execute_sql`: `select name from storage.objects where bucket_id='avatars';`).

- [ ] **Step 5: Commit**

```bash
git add lib/profile/avatar.ts app/onboarding/profile-setup.tsx
git commit -m "feat: upload profile avatars to supabase storage"
```

---

## Phase 9 — Verification

### Task 9.1: End-to-end email flow in Expo Go

- [ ] **Step 1: Run the app**

Run: `npx expo start` -> open in Expo Go.

- [ ] **Step 2: Full happy path**

slides -> choose -> create account -> email/password/confirm -> check-email. Confirm the email via the inbox link. Then sign-in -> profile wizard (basics -> bike) -> tabs.

- [ ] **Step 3: Verify data landed**

MCP `execute_sql`:
```sql
select id, name, skill_level, bike from public.profiles order by updated_at desc limit 5;
```
Expected: a row with the name + skill you entered.

- [ ] **Step 4: Record a ride, verify it persists**

Complete a ride in the app, then MCP `execute_sql`:
```sql
select id, distance_meters, jsonb_array_length(samples) as n_samples from public.rides order by ended_at desc limit 3;
```
Expected: a new ride row with samples. Sign out and back in; history still shows it.

### Task 9.2: Security advisors + full test suite

- [ ] **Step 1: Advisors**

MCP `get_advisors` type `security`. Expected: no RLS/policy gaps on `profiles`, `rides`, or storage. Fix anything flagged.

- [ ] **Step 2: Run all unit tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS; no type errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: address advisors and finalize backend migration"
```

### Task 9.3: Apple/Google enablement notes (deferred external setup)

> Code ships in Phase 4/7. To make the buttons functional later:
> 1. Apple: create an App ID + Services ID + Sign in with Apple key; configure the Apple provider in Supabase Auth; add `expo-apple-authentication` plugin (already a dep) and build a dev client (`npx expo run:ios`).
> 2. Google: create OAuth client IDs (iOS + Web) in Google Cloud; set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env`; configure the Google provider in Supabase Auth; build a dev client.
> 3. Verify each provider end-to-end in the dev build (not Expo Go).

---

## Notes on remaining open items (from spec)

- **Email confirmation deep link:** for v1, the user confirms via email then returns and signs in manually (the `check-email` screen tells them to). A deep-link redirect (`draftapp://`) back into the app can be added later by configuring the redirect URL in Supabase Auth and handling it in the client.
- **Groups / Explore:** unchanged (mock/static) this iteration.
