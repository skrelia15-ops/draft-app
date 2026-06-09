# Odessa launch seed data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Explore and Groups non-empty for an Odessa launch — fix the auth-timing bug that leaves Explore blank, reseed the route catalog with Odessa routes, anchor map fallbacks to Odessa, and seed product-owned ("official") groups.

**Architecture:** `routes` is a metadata-only catalog (polylines generated client-side, anchored to GPS or a city fallback). `groups` gains a nullable `owner_id` + `is_official` flag so the product can seed ownerless groups. The empty-Explore root cause is an auth-state race in `RoutesProvider`, fixed by mirroring `GroupsProvider`'s `onAuthStateChange` reload pattern.

**Tech Stack:** Expo / React Native, TypeScript, Supabase (Postgres + RLS), Jest (jest-expo).

**Spec:** `docs/superpowers/specs/2026-06-09-odessa-seed-data-design.md`

**Working branch:** `feature/supabase-backend-auth` (checked out at the repo root `/Users/viola/draft-app`).

---

## File Structure

- `lib/maps/constants.ts` — **new**. Shared `ODESSA` fallback anchor constant.
- `lib/maps/index.ts` — **modify**. Re-export `ODESSA`.
- `lib/routes/RoutesProvider.tsx` — **modify**. Auth-aware catalog load (the bug fix).
- `app/(tabs)/explore.tsx` — **modify**. Manhattan → Odessa fallback.
- `app/ride/route-details.tsx` — **modify**. Manhattan → Odessa fallback.
- `app/ride/map.tsx` — **modify**. `FALLBACK_REGION` center → Odessa.
- `supabase/migrations/20260609040000_seed_odessa_routes.sql` — **new**. Reseed routes.
- `supabase/migrations/20260609050000_official_groups.sql` — **new**. Schema change + seed groups.
- `lib/groups/mappers.ts` — **modify**. `GroupRow` gains `is_official`, nullable `owner_id`.
- `lib/groups/mappers.test.ts` — **modify**. Cover the new field + null owner.
- `lib/groups/storage.ts` — **modify**. Order official groups first in Discover.
- `lib/supabase/database.types.ts` — **modify**. New column + nullable `owner_id`.

---

## Task 1: Shared `ODESSA` fallback anchor

**Files:**
- Create: `lib/maps/constants.ts`
- Modify: `lib/maps/index.ts`

- [ ] **Step 1: Create the constant**

`lib/maps/constants.ts`:

```ts
import type { LatLng } from './polyline';

/**
 * Fallback map anchor used when the user's GPS is unavailable. Odessa city
 * center. With a GPS fix the app anchors to the user instead; this is only
 * the no-location fallback.
 */
export const ODESSA: LatLng = { latitude: 46.4825, longitude: 30.7233 };
```

- [ ] **Step 2: Re-export it**

In `lib/maps/index.ts`, add after the `decodePolyline` export line:

```ts
export { ODESSA } from './constants';
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/maps/constants.ts lib/maps/index.ts
git commit -m "feat(maps): add shared ODESSA fallback anchor constant"
```

---

## Task 2: Fix `RoutesProvider` to load on auth state (empty-Explore bug)

**Files:**
- Modify: `lib/routes/RoutesProvider.tsx`

Root cause: the catalog RLS is `to authenticated`, but the provider fetches once on mount — before `AuthProvider` restores the persisted session — so the request runs as anon and RLS returns `[]`, then never refetches. Mirror `GroupsProvider`: load on `onAuthStateChange`, dedupe by uid, clear on sign-out.

- [ ] **Step 1: Replace the provider body**

Replace the entire contents of `lib/routes/RoutesProvider.tsx` with:

```tsx
// lib/routes/RoutesProvider.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { listRoutes } from './storage';
import { findRouteIn } from './helpers';
import type { CatalogRoute } from './types';

/**
 * Loads the route catalog from Supabase and exposes it to
 * Explore / RouteDetails / Groups.
 *
 * The catalog is readable only by authenticated users (RLS), so we must wait
 * for the session to be restored before fetching — otherwise the first
 * request goes out as anon and RLS returns []. We therefore load in response
 * to `onAuthStateChange` (same pattern as GroupsProvider) rather than a
 * one-shot mount fetch. `refresh` stays exposed for pull-to-refresh.
 */
type RoutesContextValue = {
  routes: CatalogRoute[];
  isHydrated: boolean;
  findRoute: (id: string | undefined) => CatalogRoute | undefined;
  refresh: () => Promise<void>;
};

const RoutesContext = createContext<RoutesContextValue | null>(null);

export function RoutesProvider({ children }: { children: ReactNode }) {
  const [routes, setRoutes] = useState<CatalogRoute[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listRoutes();
    setRoutes(list);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    let lastUid: string | null | undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid === lastUid) return;
      lastUid = uid;
      if (!uid) {
        setRoutes([]);
        setIsHydrated(true);
        return;
      }
      setIsHydrated(false);
      refresh().catch((e) => {
        console.warn('[RoutesProvider] load failed', e);
        setIsHydrated(true);
      });
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const findRoute = useCallback(
    (id: string | undefined) => findRouteIn(routes, id),
    [routes],
  );

  const value = useMemo(
    () => ({ routes, isHydrated, findRoute, refresh }),
    [routes, isHydrated, findRoute, refresh],
  );

  return <RoutesContext.Provider value={value}>{children}</RoutesContext.Provider>;
}

export function useRoutes(): RoutesContextValue {
  const ctx = useContext(RoutesContext);
  if (!ctx) {
    throw new Error('useRoutes must be used inside <RoutesProvider>.');
  }
  return ctx;
}
```

Note: `supabase-js` emits an `INITIAL_SESSION` event after restoring the persisted session, so this fires on cold start for an already-signed-in user (the same mechanism `GroupsProvider` relies on).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/routes/RoutesProvider.tsx
git commit -m "fix(routes): load catalog on auth state, not on mount

The catalog RLS is authenticated-only; fetching once on mount raced the
session restore and returned [] forever, leaving Explore empty. Mirror
GroupsProvider and load on onAuthStateChange."
```

---

## Task 3: Anchor map fallbacks to Odessa

**Files:**
- Modify: `app/(tabs)/explore.tsx`
- Modify: `app/ride/route-details.tsx`
- Modify: `app/ride/map.tsx`

In both `explore.tsx` and `route-details.tsx`, `LatLng` is imported only to type the `MANHATTAN` constant, so dropping `MANHATTAN` lets us drop the `LatLng` import and add `ODESSA`.

- [ ] **Step 1: explore.tsx — swap import**

Change line 14:

```ts
import { darkMapStyle, type LatLng } from '@/lib/maps';
```

to:

```ts
import { darkMapStyle, ODESSA } from '@/lib/maps';
```

- [ ] **Step 2: explore.tsx — remove MANHATTAN, use ODESSA**

Delete line 50:

```ts
const MANHATTAN: LatLng = { latitude: 40.7484, longitude: -73.9857 };
```

Change line 129 from:

```ts
  const origin = coords ?? MANHATTAN;
```

to:

```ts
  const origin = coords ?? ODESSA;
```

- [ ] **Step 3: route-details.tsx — swap import**

Change line 2:

```ts
import { darkMapStyle, type LatLng } from '@/lib/maps';
```

to:

```ts
import { darkMapStyle, ODESSA } from '@/lib/maps';
```

- [ ] **Step 4: route-details.tsx — remove MANHATTAN, use ODESSA**

Delete line 32:

```ts
const MANHATTAN: LatLng = { latitude: 40.7484, longitude: -73.9857 };
```

Change line 50 from:

```ts
  const origin = coords ?? MANHATTAN;
```

to:

```ts
  const origin = coords ?? ODESSA;
```

- [ ] **Step 5: map.tsx — add ODESSA to the maps import**

In the `} from '@/lib/maps';` block (ends at line 46), add `ODESSA,` to the import list, e.g. directly after `darkMapStyle,`:

```ts
import {
  autocompletePlaces,
  darkMapStyle,
  ODESSA,
  getCyclingDirections,
  getPlaceDetails,
  type LatLng,
  type PlacePrediction,
  type RouteResult,
} from '@/lib/maps';
```

(`LatLng` stays — it is used by the `Endpoint` type in this file.)

- [ ] **Step 6: map.tsx — point FALLBACK_REGION at Odessa**

Replace the `FALLBACK_REGION` block (lines 50–60) so the comment and coordinates reference Odessa:

```ts
/**
 * Default region centered on Odessa — used briefly before the first
 * location fix arrives. The map animates to the user's actual position
 * as soon as `useUserLocation` resolves.
 */
const FALLBACK_REGION: Region = {
  latitude: ODESSA.latitude,
  longitude: ODESSA.longitude,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
```

- [ ] **Step 7: Verify no stray Manhattan fallback remains**

Run: `grep -rn "MANHATTAN\|40.7484" "app/(tabs)/explore.tsx" app/ride/route-details.tsx app/ride/map.tsx`
Expected: no matches.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (in particular, no "LatLng is declared but never used").

- [ ] **Step 9: Commit**

```bash
git add "app/(tabs)/explore.tsx" app/ride/route-details.tsx app/ride/map.tsx
git commit -m "feat(maps): use Odessa as the no-GPS fallback anchor"
```

---

## Task 4: Reseed the route catalog with Odessa routes

**Files:**
- Create: `supabase/migrations/20260609040000_seed_odessa_routes.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260609040000_seed_odessa_routes.sql`:

```sql
-- Reseed the route catalog with Odessa-named routes for launch.
-- Replaces the three generic placeholder rows. Geometry is generated
-- client-side (anchored to GPS, falling back to Odessa), so no coordinates
-- are stored here. group_rides.route_id is ON DELETE SET NULL, so removing
-- the old rows is safe. Idempotent via ON CONFLICT.

delete from public.routes where id in ('coastal', 'urban', 'mountain');

insert into public.routes
  (id, name, distance_km, difficulty, shape, pace_kmh, riders, draft_percent, traffic, note)
values
  ('arcadia-coastal',    'ARCADIA COASTAL SLIPSTREAM', 24.5, 'MODERATE', 'point-to-point', 32,  8, 92, 'MODERATE', 'Best drafting right now'),
  ('french-blvd',        'FRENCH BOULEVARD LOOP',      12.2, 'EASY',     'loop',           28, 15, 88, 'CLEAR',    null),
  ('vel-fontan',         'VELYKYI FONTAN OUT & BACK',  35.0, 'HARD',     'out-and-back',   24,  4, 78, 'CLEAR',    null),
  ('otrada-seaside',     'OTRADA SEASIDE CRUISE',       9.0, 'EASY',     'loop',           26, 11, 84, 'CLEAR',    null),
  ('lanzheron-sprint',   'LANZHERON SPRINT',           18.0, 'MODERATE', 'point-to-point', 31,  6, 86, 'MODERATE', null),
  ('derybasivska-draft', 'DERYBASIVSKA URBAN DRAFT',   14.0, 'EASY',     'loop',           27,  9, 83, 'CLEAR',    null)
on conflict (id) do update set
  name          = excluded.name,
  distance_km   = excluded.distance_km,
  difficulty    = excluded.difficulty,
  shape         = excluded.shape,
  pace_kmh      = excluded.pace_kmh,
  riders        = excluded.riders,
  draft_percent = excluded.draft_percent,
  traffic       = excluded.traffic,
  note          = excluded.note;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260609040000_seed_odessa_routes.sql
git commit -m "feat(db): reseed route catalog with Odessa routes"
```

(Applied to the live DB in Task 9.)

---

## Task 5: Schema migration for official groups + seed

**Files:**
- Create: `supabase/migrations/20260609050000_official_groups.sql`

Postgres cannot `CREATE OR REPLACE VIEW` when an existing output column shifts position; adding `is_official` to `groups` shifts `member_count`, so the view must be dropped and recreated.

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260609050000_official_groups.sql`:

```sql
-- Allow product-owned ("official") groups: ownerless, seeded for launch.

alter table public.groups alter column owner_id drop not null;
alter table public.groups add column if not exists is_official boolean not null default false;

-- Only add an owner membership row when there is an owner (official groups
-- have none). Replaces the original trigger function; keep it SECURITY DEFINER
-- and non-directly-callable (matches the hardening migration).
create or replace function public.handle_group_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null then
    insert into public.group_members (group_id, user_id, role)
    values (new.id, new.owner_id, 'owner');
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_group_created() from public, anon, authenticated;

-- Tighten insert: authenticated users may only create non-official groups they
-- own. Official groups are inserted by seed/migration (no JWT, RLS not enforced).
drop policy if exists "groups insertable by owner" on public.groups;
create policy "groups insertable by owner"
  on public.groups for insert to authenticated
  with check (owner_id = auth.uid() and is_official = false);

-- Recreate the member-count view so it picks up the new column, then re-apply
-- security_invoker (set originally in the hardening migration).
drop view if exists public.groups_with_counts;
create view public.groups_with_counts as
  select g.*, count(m.user_id)::int as member_count
  from public.groups g
  left join public.group_members m on m.group_id = g.id
  group by g.id;
alter view public.groups_with_counts set (security_invoker = true);

-- Seed the launch official groups (ownerless).
insert into public.groups (name, description, pace_kmh, train_type, owner_id, is_official)
values
  ('ARCADIA RIDERS',          'Easy coastal cruises around Arcadia.',                28, 'STEADY',   null, true),
  ('FRENCH BOULEVARD TEMPO',  'Tempo efforts down the boulevard, no drop.',          30, 'TEMPO',    null, true),
  ('VELYKYI FONTAN ROTATION', 'Rotating pacelines on the long southern roads.',      33, 'ROTATING', null, true),
  ('PORT DAWN PATROL',        'Early starts, fast rotations before the city wakes.', 32, 'ROTATING', null, true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260609050000_official_groups.sql
git commit -m "feat(db): support ownerless official groups + seed Odessa groups"
```

(Applied to the live DB in Task 9.)

---

## Task 6: Update `GroupRow` mapper for the new column (TDD)

**Files:**
- Modify: `lib/groups/mappers.test.ts`
- Modify: `lib/groups/mappers.ts`

- [ ] **Step 1: Update the failing test first**

In `lib/groups/mappers.test.ts`, add `is_official: false` to the `ROW` fixture (so it satisfies the new `GroupRow` type) and add a null-owner case. Change the `ROW` definition to:

```ts
  const ROW: GroupRow = {
    id: 'g1',
    name: 'DAWN PATROL',
    description: null,
    pace_kmh: 32,
    train_type: 'ROTATING',
    owner_id: 'u1',
    is_official: false,
    member_count: 22,
    created_at: '2026-06-09T00:00:00Z',
  };
```

And add this test inside the `describe('rowToGroup', …)` block, after the existing `member_count` test:

```ts
  it('maps a null owner_id (official groups) to an empty string', () => {
    expect(rowToGroup({ ...ROW, owner_id: null }, false).ownerId).toBe('');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/groups/mappers.test.ts`
Expected: FAIL — TypeScript error that `is_official` is not assignable / missing on `GroupRow`, and `owner_id: null` not assignable to `string`.

- [ ] **Step 3: Update the mapper**

In `lib/groups/mappers.ts`, change the `GroupRow` type and `rowToGroup`:

```ts
export type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  pace_kmh: number;
  train_type: TrainType;
  owner_id: string | null;
  is_official: boolean;
  member_count: number | null;
  created_at: string;
};

export function rowToGroup(row: GroupRow, isMember: boolean): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    paceKmh: row.pace_kmh,
    trainType: row.train_type,
    ownerId: row.owner_id ?? '',
    memberCount: row.member_count ?? 0,
    isMember,
    createdAt: parseTs(row.created_at),
  };
}
```

(`Group.ownerId` stays `string`; an ownerless official group maps to `''`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/groups/mappers.test.ts`
Expected: PASS (all `rowToGroup` / `rowToGroupRide` cases green).

- [ ] **Step 5: Commit**

```bash
git add lib/groups/mappers.ts lib/groups/mappers.test.ts
git commit -m "feat(groups): map is_official + nullable owner_id in GroupRow"
```

---

## Task 7: Update `database.types.ts`

**Files:**
- Modify: `lib/supabase/database.types.ts`

The Supabase types are normally generated, but neither the CLI nor MCP is available locally, so hand-edit. `storage.ts` casts view rows via `as unknown as GroupRow`, so these edits are about keeping table types honest, not the mapper.

- [ ] **Step 1: groups table `Row`**

In the `groups: { Row: { … } }` block, change `owner_id: string` to `owner_id: string | null` and add `is_official: boolean`:

```ts
        Row: {
          created_at: string
          description: string | null
          id: string
          is_official: boolean
          name: string
          owner_id: string | null
          pace_kmh: number
          train_type: string
        }
```

- [ ] **Step 2: groups table `Insert`**

```ts
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_official?: boolean
          name: string
          owner_id?: string | null
          pace_kmh: number
          train_type: string
        }
```

- [ ] **Step 3: groups table `Update`**

```ts
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_official?: boolean
          name?: string
          owner_id?: string | null
          pace_kmh?: number
          train_type?: string
        }
```

- [ ] **Step 4: groups_with_counts view `Row`**

Add `is_official: boolean | null` to the view row block:

```ts
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          is_official: boolean | null
          member_count: number | null
          name: string | null
          owner_id: string | null
          pace_kmh: number | null
          train_type: string | null
        }
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/database.types.ts
git commit -m "chore(types): add is_official + nullable owner_id to groups types"
```

---

## Task 8: Surface official groups first in Discover

**Files:**
- Modify: `lib/groups/storage.ts`

Official groups start at 0 members, so order them first (then by member count) so they don't sink to the bottom of Discover.

- [ ] **Step 1: Add the ordering**

In `listDiscoverGroups`, change the query builder from:

```ts
  let query = supabase
    .from('groups_with_counts')
    .select('*')
    .order('member_count', { ascending: false });
```

to:

```ts
  let query = supabase
    .from('groups_with_counts')
    .select('*')
    .order('is_official', { ascending: false })
    .order('member_count', { ascending: false });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/groups/storage.ts
git commit -m "feat(groups): order official groups first in Discover"
```

---

## Task 9: Apply both migrations to the live Supabase project

**Project:** `fdjeihhtciooahpteign` (eu-west-3).

The Supabase MCP is not connected in the current session and the Supabase CLI is not installed locally. Use whichever path is available:

- **Path A (preferred) — Supabase MCP:** if the user reconnects the Supabase MCP, apply each migration with the MCP `apply_migration` tool (one per file, in filename order: `…040000_seed_odessa_routes.sql` then `…050000_official_groups.sql`).
- **Path B — SQL editor:** paste the contents of each migration file (in the same order) into the Supabase Studio SQL editor and run them.

- [ ] **Step 1: Confirm the application path with the user** (MCP reconnected, or they will run the SQL). Do not guess — this is an external side effect on the live DB.

- [ ] **Step 2: Apply `20260609040000_seed_odessa_routes.sql`** via the chosen path.

- [ ] **Step 3: Apply `20260609050000_official_groups.sql`** via the chosen path.

- [ ] **Step 4: Verify rows landed**

Via MCP `execute_sql` (service role) or the SQL editor, run:

```sql
select count(*) from public.routes;                       -- expect 6
select id, name from public.routes order by id;           -- the six Odessa ids
select name, train_type, is_official from public.groups
  where is_official order by name;                         -- the four official groups
```

Expected: 6 routes (`arcadia-coastal`, `derybasivska-draft`, `french-blvd`, `lanzheron-sprint`, `otrada-seaside`, `vel-fontan`); 4 official groups.

- [ ] **Step 5: Sanity-check the anon REST endpoint still returns `[]`** (RLS unchanged for anon):

```bash
set -a; . ./.env; set +a
curl -s -w "\nHTTP:%{http_code}\n" \
  "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/routes?select=id" \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

Expected: `HTTP:200` and `[]` (rows exist but are RLS-hidden from anon — confirms the catalog is authenticated-only and the Task 2 fix is what surfaces it).

---

## Task 10: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Run the test suite**

Run: `npm test`
Expected: all suites pass (auth gating, profile/ride/routes/groups mappers).

- [ ] **Step 3: Manual cold-start check (simulator/Expo Go, signed in)**

- Explore tab: **shows the six Odessa routes** (must NOT be empty — this is the Task 2 regression). Mini-maps render around the user with GPS on, around Odessa with GPS off.
- Groups tab → Discover: shows the four official groups (ARCADIA RIDERS, FRENCH BOULEVARD TEMPO, VELYKYI FONTAN ROTATION, PORT DAWN PATROL), each at 0 riders until joined.
- Tapping a route opens route-details with a preview; tapping a group opens its detail with a Join button.

- [ ] **Step 4: Final no-op commit guard**

Run: `git status`
Expected: clean working tree (everything committed in earlier tasks).

---

## Notes / out of scope

- No `OFFICIAL` badge UI this iteration (`is_official` is for seeding, RLS, and Discover ordering only).
- No scheduled rides for official groups (`group_rides.created_by` requires an auth user).
- No stored per-route geometry (light fallback-anchor approach chosen).
