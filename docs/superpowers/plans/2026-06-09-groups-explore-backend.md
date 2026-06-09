# Groups & Explore Supabase Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Back the Groups and Explore surfaces with Supabase — Explore reads its route catalog from a `routes` table; Groups gains full CRUD + membership + scheduled rides.

**Architecture:** Mirror the existing per-domain data-layer pattern (`lib/profile`, `lib/ride`): `types.ts` + `mappers.ts` + `storage.ts` + `<Domain>Provider.tsx` + `index.ts` against the typed `supabase` client. Migrations applied to the cloud project, `database.types.ts` regenerated. Two phases: Phase 1 (Explore/routes) is independently shippable; Phase 2 (Groups) builds on it (schedule-ride references routes).

**Tech Stack:** Expo Router 6, React Native, TypeScript, Supabase (`@supabase/supabase-js` v2), Jest + jest-expo.

**Branch:** `feature/supabase-backend-auth` (already checked out at `/Users/viola/draft-app`).

**Migration mechanism:** Apply SQL via the Supabase MCP `apply_migration` tool if connected; otherwise `npx supabase migration new <name>` + `npx supabase db push` (project is linked — `supabase/.temp/linked-project.json`). Regenerate types via the Supabase MCP type-generation tool, or `npx supabase gen types typescript --linked > lib/supabase/database.types.ts`. Confirm which mechanism is live before Task 1.

---

## File Structure

**Phase 1 — Explore / routes**
- Convert `lib/routes.ts` (a file) → `lib/routes/` (a folder), preserving the `@/lib/routes` import path via a barrel:
  - Create: `lib/routes/types.ts` — `CatalogRoute`, `Difficulty`, `TrafficLevel`
  - Create: `lib/routes/helpers.ts` — `shapeLabel`, `trafficLabel`, `trafficColor`, `hashIdSeed`, `findRouteIn`
  - Create: `lib/routes/mappers.ts` — `rowToCatalogRoute`, `RouteRow`
  - Create: `lib/routes/mappers.test.ts`
  - Create: `lib/routes/storage.ts` — `listRoutes`
  - Create: `lib/routes/RoutesProvider.tsx` — `RoutesProvider`, `useRoutes`
  - Create: `lib/routes/index.ts` — barrel
  - Delete: `lib/routes.ts`
- Modify: `app/_layout.tsx` — add `RoutesProvider`
- Modify: `app/(tabs)/explore.tsx` — read catalog from `useRoutes()`
- Modify: `app/ride/route-details.tsx` — resolve route via `useRoutes().findRoute`

**Phase 2 — Groups**
- Create: `lib/groups/types.ts`, `lib/groups/mappers.ts`, `lib/groups/mappers.test.ts`, `lib/groups/storage.ts`, `lib/groups/GroupsProvider.tsx`, `lib/groups/index.ts`
- Modify: `app/_layout.tsx` — add `GroupsProvider`, register `groups` stack screen
- Modify: `app/(tabs)/groups.tsx` — rebuild (MY GROUPS / UPCOMING RIDES / DISCOVER)
- Create: `app/groups/_layout.tsx`, `app/groups/[id].tsx`, `app/groups/create.tsx`, `app/groups/[id]/schedule-ride.tsx`

---

# PHASE 1 — Explore catalog → Supabase

## Task 1: `routes` table migration + seed

**Files:**
- Migration (cloud): name `create_routes_table`
- Modify: `lib/supabase/database.types.ts` (regenerated)

- [ ] **Step 1: Apply the migration**

Apply this SQL (via Supabase MCP `apply_migration` with name `create_routes_table`, or `npx supabase migration new create_routes_table` then paste + `db push`):

```sql
create table public.routes (
  id            text primary key,
  name          text not null,
  distance_km   numeric not null,
  difficulty    text not null check (difficulty in ('EASY','MODERATE','HARD')),
  shape         text not null check (shape in ('loop','out-and-back','point-to-point')),
  pace_kmh      integer not null,
  riders        integer not null default 0,
  draft_percent integer not null,
  traffic       text not null check (traffic in ('CLEAR','MODERATE','HEAVY')),
  note          text,
  created_at    timestamptz not null default now()
);

alter table public.routes enable row level security;

create policy "routes are readable by authenticated users"
  on public.routes for select
  to authenticated
  using (true);

insert into public.routes (id, name, distance_km, difficulty, shape, pace_kmh, riders, draft_percent, traffic, note) values
  ('coastal',  'COASTAL SLIPSTREAM', 24.5, 'MODERATE', 'point-to-point', 32,  8, 92, 'MODERATE', 'Best drafting right now'),
  ('urban',    'URBAN DRAFT LOOP',   12.2, 'EASY',     'loop',           28, 15, 88, 'CLEAR',    null),
  ('mountain', 'MOUNTAIN PASS',      35.0, 'HARD',     'out-and-back',   24,  4, 78, 'CLEAR',    null);
```

- [ ] **Step 2: Verify the seed**

Run a select (MCP `execute_sql` or dashboard): `select id, name from public.routes order by id;`
Expected: 3 rows — `coastal`, `mountain`, `urban`.

- [ ] **Step 3: Regenerate types**

Regenerate `lib/supabase/database.types.ts` (MCP type-gen tool, or `npx supabase gen types typescript --linked > lib/supabase/database.types.ts`).
Expected: a `routes` entry now exists under `Database['public']['Tables']`.

- [ ] **Step 4: Verify tsc still clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/database.types.ts supabase/
git commit -m "feat: add routes table + seed migration"
```

## Task 2: routes domain types + helpers (folder conversion, no behavior change)

**Files:**
- Create: `lib/routes/types.ts`
- Create: `lib/routes/helpers.ts`
- Create: `lib/routes/index.ts`
- Delete: `lib/routes.ts`

> This task moves the existing pure code into the new folder verbatim so `@/lib/routes` keeps resolving. The static `ROUTE_CATALOG` array and the array-bound `findRoute` are intentionally NOT carried over — they are replaced by the provider in Task 5.

- [ ] **Step 1: Create `lib/routes/types.ts`**

```ts
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
```

- [ ] **Step 2: Create `lib/routes/helpers.ts`**

```ts
import type { RouteShape } from '@/lib/ride';
import type { CatalogRoute, TrafficLevel } from './types';

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

/** Find a route in a catalog list, falling back to the first entry (or
 *  undefined if the catalog is empty / still loading). */
export function findRouteIn(
  routes: CatalogRoute[],
  id: string | undefined,
): CatalogRoute | undefined {
  if (routes.length === 0) return undefined;
  if (!id) return routes[0];
  return routes.find((r) => r.id === id) ?? routes[0];
}
```

- [ ] **Step 3: Create `lib/routes/index.ts` (barrel)**

```ts
export type { CatalogRoute, Difficulty, TrafficLevel } from './types';
export {
  shapeLabel,
  trafficLabel,
  trafficColor,
  hashIdSeed,
  findRouteIn,
} from './helpers';
export { RoutesProvider, useRoutes } from './RoutesProvider';
```

> Note: `index.ts` references `RoutesProvider` which is created in Task 5. Until then `tsc` will error on this barrel — that is expected and resolved by Task 5. Do not run the full tsc gate until Task 5.

- [ ] **Step 4: Delete the old file**

```bash
git rm lib/routes.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/routes/
git commit -m "refactor: split lib/routes into folder (types + helpers)"
```

## Task 3: route row → domain mapper (TDD)

**Files:**
- Create: `lib/routes/mappers.ts`
- Test: `lib/routes/mappers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/routes/mappers.test.ts
import { rowToCatalogRoute, type RouteRow } from './mappers';

const ROW: RouteRow = {
  id: 'coastal',
  name: 'COASTAL SLIPSTREAM',
  distance_km: 24.5,
  difficulty: 'MODERATE',
  shape: 'point-to-point',
  pace_kmh: 32,
  riders: 8,
  draft_percent: 92,
  traffic: 'MODERATE',
  note: 'Best drafting right now',
  created_at: '2026-06-09T00:00:00Z',
};

describe('rowToCatalogRoute', () => {
  it('maps snake_case columns to the camelCase domain shape', () => {
    expect(rowToCatalogRoute(ROW)).toEqual({
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
    });
  });

  it('maps a null note to undefined (so optional chaining stays clean)', () => {
    expect(rowToCatalogRoute({ ...ROW, note: null }).note).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/routes/mappers.test.ts`
Expected: FAIL — cannot find module `./mappers`.

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/routes/mappers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/routes/mappers.ts lib/routes/mappers.test.ts
git commit -m "feat: add route row->domain mapper with tests"
```

## Task 4: routes storage

**Files:**
- Create: `lib/routes/storage.ts`

- [ ] **Step 1: Write the implementation**

```ts
// lib/routes/storage.ts
import { supabase } from '@/lib/supabase';
import { rowToCatalogRoute, type RouteRow } from './mappers';
import type { CatalogRoute } from './types';

/** Load the full route catalog, sorted by drafting potential (the default
 *  Explore ordering). Returns [] on error so the UI shows an empty state
 *  rather than crashing. */
export async function listRoutes(): Promise<CatalogRoute[]> {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .order('draft_percent', { ascending: false });
  if (error || !data) {
    console.warn('[routes/storage] listRoutes failed', error);
    return [];
  }
  return (data as RouteRow[]).map(rowToCatalogRoute);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/routes/storage.ts
git commit -m "feat: add routes storage (listRoutes)"
```

## Task 5: RoutesProvider + wire into app

**Files:**
- Create: `lib/routes/RoutesProvider.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Create the provider**

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
import { listRoutes } from './storage';
import { findRouteIn } from './helpers';
import type { CatalogRoute } from './types';

/**
 * Loads the route catalog from Supabase once at startup and exposes it to
 * Explore / RouteDetails / Groups. The catalog is small and effectively
 * static, so a single fetch + in-memory cache is enough; `refresh` is
 * provided for pull-to-refresh later.
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
    refresh().catch((e) => {
      console.warn('[RoutesProvider] initial load failed', e);
      setIsHydrated(true);
    });
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

- [ ] **Step 2: Wire into `app/_layout.tsx`**

Add the import alongside the existing provider imports:

```tsx
import { RoutesProvider } from '@/lib/routes';
```

Wrap the tree — `RoutesProvider` goes just inside `ProfileProvider` (above `RideProvider`):

```tsx
    <ProfileProvider>
      <RoutesProvider>
        <RideProvider>
          {/* ...existing <Stack> ... */}
        </RideProvider>
      </RoutesProvider>
    </ProfileProvider>
```

> Keep whatever auth provider wrapping already exists outermost; only insert `RoutesProvider` at the shown position.

- [ ] **Step 3: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors (the Task 2 barrel now resolves `RoutesProvider`).

- [ ] **Step 4: Commit**

```bash
git add lib/routes/RoutesProvider.tsx app/_layout.tsx
git commit -m "feat: add RoutesProvider and wire into app layout"
```

## Task 6: migrate Explore to the provider

**Files:**
- Modify: `app/(tabs)/explore.tsx`

- [ ] **Step 1: Swap the catalog source**

In `app/(tabs)/explore.tsx`:

1. Update the import from `@/lib/routes` — remove `ROUTE_CATALOG` and `type CatalogRoute` from the static import; keep `hashIdSeed`, `shapeLabel`, `type CatalogRoute`, and add `useRoutes`:

```ts
import {
  hashIdSeed,
  shapeLabel,
  useRoutes,
  type CatalogRoute,
} from '@/lib/routes';
```

2. Inside `ExploreScreen`, read the catalog from context:

```tsx
  const { routes: catalog } = useRoutes();
```

3. Replace every `ROUTE_CATALOG` reference with `catalog`:
   - `filteredRoutes` memo: `catalog.filter(...)` and `filterRoutes(catalog, activeFilter)`; add `catalog` to its dependency array.
   - `previewById` memo: iterate `for (const route of catalog)`; add `catalog` to its dependency array.

> `ExploreRoute`/`CatalogRoute` typing and `filterRoutes`/`RouteMiniMap`/`RouteCardBody` are unchanged.

- [ ] **Step 2: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors; no remaining references to `ROUTE_CATALOG`.

- [ ] **Step 3: Verify no stale references**

Run: `grep -rn "ROUTE_CATALOG\|from '@/lib/routes'" app lib | grep -v node_modules`
Expected: no `ROUTE_CATALOG` hits; `@/lib/routes` imports only pull named helpers/`useRoutes`.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/explore.tsx"
git commit -m "feat: read Explore catalog from RoutesProvider"
```

## Task 7: migrate RouteDetails to the provider

**Files:**
- Modify: `app/ride/route-details.tsx`

- [ ] **Step 1: Inspect current usage**

Run: `grep -n "findRoute\|@/lib/routes" app/ride/route-details.tsx`
Expected: shows a `findRoute` import from `@/lib/routes` and a `findRoute(id)` call.

- [ ] **Step 2: Swap to the provider's findRoute**

1. Replace the `findRoute` import with `useRoutes` (keep any other helpers like `shapeLabel`/`trafficLabel` imported from `@/lib/routes`).
2. In the component body add `const { findRoute, isHydrated } = useRoutes();`.
3. Replace `const route = findRoute(id);` with the same call (now from context). `findRoute` may return `undefined` while the catalog loads — guard it:

```tsx
  const route = findRoute(id);
  if (!route) {
    // Catalog still loading or unknown id — render nothing rather than crash.
    return null;
  }
```

> Place the guard after all hooks are called (React rules-of-hooks) — i.e. compute `route` from `findRoute` after the existing hook calls, then early-return.

- [ ] **Step 3: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify no stale references**

Run: `grep -rn "findRouteIn\|ROUTE_CATALOG" app | grep -v node_modules`
Expected: no hits in `app/` (screens use `findRoute` from context, not the pure helper).

- [ ] **Step 5: Commit**

```bash
git add app/ride/route-details.tsx
git commit -m "feat: resolve RouteDetails route via RoutesProvider"
```

**Phase 1 checkpoint:** `npx tsc --noEmit` clean and `npx jest` green. Explore and RouteDetails now read from Supabase. This is independently shippable.

---

# PHASE 2 — Groups

## Task 8: groups schema migration (tables, view, trigger, RLS)

**Files:**
- Migration (cloud): name `create_groups`
- Modify: `lib/supabase/database.types.ts` (regenerated)

- [ ] **Step 1: Apply the migration**

```sql
-- groups
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  pace_kmh    integer not null,
  train_type  text not null check (train_type in ('ROTATING','STEADY','TEMPO')),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- group_members
create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- group_rides
create table public.group_rides (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  title        text not null,
  scheduled_at timestamptz not null,
  route_id     text references public.routes(id) on delete set null,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- member count view (derives the UI "riders" figure)
create view public.groups_with_counts as
  select g.*, count(m.user_id)::int as member_count
  from public.groups g
  left join public.group_members m on m.group_id = g.id
  group by g.id;

-- add the owner as a member automatically on group creation
create function public.handle_group_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_group_created();

-- helper: is the current user a member of this group?
create function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- RLS
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_rides enable row level security;

-- groups
create policy "groups readable by authenticated"
  on public.groups for select to authenticated using (true);
create policy "groups insertable by owner"
  on public.groups for insert to authenticated with check (owner_id = auth.uid());
create policy "groups updatable by owner"
  on public.groups for update to authenticated using (owner_id = auth.uid());
create policy "groups deletable by owner"
  on public.groups for delete to authenticated using (owner_id = auth.uid());

-- group_members
create policy "members readable by authenticated"
  on public.group_members for select to authenticated using (true);
create policy "join self"
  on public.group_members for insert to authenticated
  with check (user_id = auth.uid() and role = 'member');
create policy "leave self or owner removes"
  on public.group_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

-- group_rides
create policy "rides readable by authenticated"
  on public.group_rides for select to authenticated using (true);
create policy "rides insertable by members"
  on public.group_rides for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_member(group_id));
create policy "rides updatable by creator"
  on public.group_rides for update to authenticated using (created_by = auth.uid());
create policy "rides deletable by creator or owner"
  on public.group_rides for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
```

> The `groups_with_counts` view runs with the querying user's privileges and is subject to the underlying tables' RLS (Postgres 15+ `security_invoker` is the default for the base-table RLS here since selects are open to authenticated). Verify advisors after applying.

- [ ] **Step 2: Check advisors**

Run the Supabase security/performance advisors (MCP `get_advisors`, or dashboard → Advisors).
Expected: no new ERROR-level findings. Address any "RLS disabled" or "security definer view" warnings if they appear (the view exposes only group rows, which are already world-readable to authenticated users — acceptable).

- [ ] **Step 3: Regenerate types**

Regenerate `lib/supabase/database.types.ts`.
Expected: `groups`, `group_members`, `group_rides` tables and the `groups_with_counts` view appear.

- [ ] **Step 4: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/database.types.ts supabase/
git commit -m "feat: add groups schema (tables, view, trigger, RLS)"
```

## Task 9: groups domain types

**Files:**
- Create: `lib/groups/types.ts`

- [ ] **Step 1: Write the types**

```ts
// lib/groups/types.ts
export type TrainType = 'ROTATING' | 'STEADY' | 'TEMPO';
export type MemberRole = 'owner' | 'member';

export type Group = {
  id: string;
  name: string;
  description: string | null;
  paceKmh: number;
  trainType: TrainType;
  ownerId: string;
  /** Derived from groups_with_counts.member_count. */
  memberCount: number;
  /** Whether the current user belongs to this group (set by storage). */
  isMember: boolean;
  createdAt: number;
};

export type GroupMember = {
  groupId: string;
  userId: string;
  role: MemberRole;
  joinedAt: number;
  /** Joined from profiles for display. */
  name: string;
  avatarUri: string | null;
};

export type GroupRide = {
  id: string;
  groupId: string;
  /** Joined from groups for the cross-group UPCOMING list. */
  groupName: string;
  title: string;
  scheduledAt: number;
  routeId: string | null;
  createdBy: string;
  createdAt: number;
};

export function trainTypeLabel(type: TrainType): string {
  if (type === 'ROTATING') return 'Rotating';
  if (type === 'STEADY') return 'Steady';
  return 'Tempo';
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/groups/types.ts
git commit -m "feat: add groups domain types"
```

## Task 10: groups mappers (TDD)

**Files:**
- Create: `lib/groups/mappers.ts`
- Test: `lib/groups/mappers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/groups/mappers.test.ts
import {
  rowToGroup,
  rowToGroupMember,
  rowToGroupRide,
  type GroupRow,
  type GroupMemberRow,
  type GroupRideRow,
} from './mappers';

describe('rowToGroup', () => {
  const ROW: GroupRow = {
    id: 'g1',
    name: 'DAWN PATROL',
    description: null,
    pace_kmh: 32,
    train_type: 'ROTATING',
    owner_id: 'u1',
    member_count: 22,
    created_at: '2026-06-09T00:00:00Z',
  };

  it('maps columns and carries the member flag from the caller', () => {
    expect(rowToGroup(ROW, true)).toEqual({
      id: 'g1',
      name: 'DAWN PATROL',
      description: null,
      paceKmh: 32,
      trainType: 'ROTATING',
      ownerId: 'u1',
      memberCount: 22,
      isMember: true,
      createdAt: Date.parse('2026-06-09T00:00:00Z'),
    });
  });

  it('defaults member_count to 0 when the view returns null', () => {
    expect(rowToGroup({ ...ROW, member_count: null }, false).memberCount).toBe(0);
  });
});

describe('rowToGroupMember', () => {
  it('flattens the joined profile and falls back to a placeholder name', () => {
    const row: GroupMemberRow = {
      group_id: 'g1',
      user_id: 'u2',
      role: 'member',
      joined_at: '2026-06-09T00:00:00Z',
      profiles: { name: 'Lena', avatar_url: 'http://x/a.png' },
    };
    expect(rowToGroupMember(row)).toEqual({
      groupId: 'g1',
      userId: 'u2',
      role: 'member',
      joinedAt: Date.parse('2026-06-09T00:00:00Z'),
      name: 'Lena',
      avatarUri: 'http://x/a.png',
    });
    expect(rowToGroupMember({ ...row, profiles: null }).name).toBe('Rider');
  });
});

describe('rowToGroupRide', () => {
  it('maps columns and flattens the joined group name', () => {
    const row: GroupRideRow = {
      id: 'r1',
      group_id: 'g1',
      title: 'Sunday spin',
      scheduled_at: '2026-06-14T07:00:00Z',
      route_id: 'coastal',
      created_by: 'u1',
      created_at: '2026-06-09T00:00:00Z',
      groups: { name: 'DAWN PATROL' },
    };
    expect(rowToGroupRide(row)).toEqual({
      id: 'r1',
      groupId: 'g1',
      groupName: 'DAWN PATROL',
      title: 'Sunday spin',
      scheduledAt: Date.parse('2026-06-14T07:00:00Z'),
      routeId: 'coastal',
      createdBy: 'u1',
      createdAt: Date.parse('2026-06-09T00:00:00Z'),
    });
    expect(rowToGroupRide({ ...row, groups: null }).groupName).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/groups/mappers.test.ts`
Expected: FAIL — cannot find module `./mappers`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/groups/mappers.ts
import type { Group, GroupMember, GroupRide, MemberRole, TrainType } from './types';

function parseTs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  pace_kmh: number;
  train_type: TrainType;
  owner_id: string;
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
    ownerId: row.owner_id,
    memberCount: row.member_count ?? 0,
    isMember,
    createdAt: parseTs(row.created_at),
  };
}

export type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  profiles: { name: string; avatar_url: string | null } | null;
};

export function rowToGroupMember(row: GroupMemberRow): GroupMember {
  return {
    groupId: row.group_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: parseTs(row.joined_at),
    name: row.profiles?.name || 'Rider',
    avatarUri: row.profiles?.avatar_url ?? null,
  };
}

export type GroupRideRow = {
  id: string;
  group_id: string;
  title: string;
  scheduled_at: string;
  route_id: string | null;
  created_by: string;
  created_at: string;
  groups: { name: string } | null;
};

export function rowToGroupRide(row: GroupRideRow): GroupRide {
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.groups?.name ?? '',
    title: row.title,
    scheduledAt: parseTs(row.scheduled_at),
    routeId: row.route_id,
    createdBy: row.created_by,
    createdAt: parseTs(row.created_at),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/groups/mappers.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add lib/groups/mappers.ts lib/groups/mappers.test.ts
git commit -m "feat: add groups mappers with tests"
```

## Task 11: groups storage

**Files:**
- Create: `lib/groups/storage.ts`

- [ ] **Step 1: Write the implementation**

```ts
// lib/groups/storage.ts
import { supabase } from '@/lib/supabase';
import {
  rowToGroup,
  rowToGroupMember,
  rowToGroupRide,
  type GroupRow,
  type GroupMemberRow,
  type GroupRideRow,
} from './mappers';
import type { Group, GroupMember, GroupRide, TrainType } from './types';

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function myGroupIds(): Promise<Set<string>> {
  const uid = await currentUserId();
  if (!uid) return new Set();
  const { data } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', uid);
  return new Set((data ?? []).map((r) => r.group_id));
}

export async function listMyGroups(): Promise<Group[]> {
  const ids = await myGroupIds();
  if (ids.size === 0) return [];
  const { data, error } = await supabase
    .from('groups_with_counts')
    .select('*')
    .in('id', [...ids])
    .order('member_count', { ascending: false });
  if (error || !data) {
    console.warn('[groups/storage] listMyGroups failed', error);
    return [];
  }
  return (data as GroupRow[]).map((r) => rowToGroup(r, true));
}

export async function listDiscoverGroups(): Promise<Group[]> {
  const ids = await myGroupIds();
  let query = supabase
    .from('groups_with_counts')
    .select('*')
    .order('member_count', { ascending: false });
  if (ids.size > 0) {
    query = query.not('id', 'in', `(${[...ids].join(',')})`);
  }
  const { data, error } = await query;
  if (error || !data) {
    console.warn('[groups/storage] listDiscoverGroups failed', error);
    return [];
  }
  return (data as GroupRow[]).map((r) => rowToGroup(r, false));
}

export async function getGroup(id: string): Promise<Group | null> {
  const ids = await myGroupIds();
  const { data, error } = await supabase
    .from('groups_with_counts')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return rowToGroup(data as GroupRow, ids.has(id));
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, user_id, role, joined_at, profiles(name, avatar_url)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });
  if (error || !data) return [];
  return (data as unknown as GroupMemberRow[]).map(rowToGroupMember);
}

export async function createGroup(input: {
  name: string;
  description: string | null;
  paceKmh: number;
  trainType: TrainType;
}): Promise<Group | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('groups')
    .insert({
      name: input.name,
      description: input.description,
      pace_kmh: input.paceKmh,
      train_type: input.trainType,
      owner_id: uid,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.warn('[groups/storage] createGroup failed', error);
    return null;
  }
  // The on_group_created trigger adds the owner as a member.
  return getGroup(data.id);
}

export async function updateGroup(
  id: string,
  patch: { name?: string; description?: string | null; paceKmh?: number; trainType?: TrainType },
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.paceKmh !== undefined) payload.pace_kmh = patch.paceKmh;
  if (patch.trainType !== undefined) payload.train_type = patch.trainType;
  const { error } = await supabase.from('groups').update(payload).eq('id', id);
  if (error) {
    console.warn('[groups/storage] updateGroup failed', error);
    return false;
  }
  return true;
}

export async function deleteGroup(id: string): Promise<boolean> {
  const { error } = await supabase.from('groups').delete().eq('id', id);
  if (error) {
    console.warn('[groups/storage] deleteGroup failed', error);
    return false;
  }
  return true;
}

export async function joinGroup(groupId: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: uid, role: 'member' });
  if (error) {
    console.warn('[groups/storage] joinGroup failed', error);
    return false;
  }
  return true;
}

export async function leaveGroup(groupId: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', uid);
  if (error) {
    console.warn('[groups/storage] leaveGroup failed', error);
    return false;
  }
  return true;
}

const RIDE_SELECT =
  'id, group_id, title, scheduled_at, route_id, created_by, created_at, groups(name)';

export async function listUpcomingRides(): Promise<GroupRide[]> {
  const ids = await myGroupIds();
  if (ids.size === 0) return [];
  const { data, error } = await supabase
    .from('group_rides')
    .select(RIDE_SELECT)
    .in('group_id', [...ids])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });
  if (error || !data) return [];
  return (data as unknown as GroupRideRow[]).map(rowToGroupRide);
}

export async function listGroupRides(groupId: string): Promise<GroupRide[]> {
  const { data, error } = await supabase
    .from('group_rides')
    .select(RIDE_SELECT)
    .eq('group_id', groupId)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });
  if (error || !data) return [];
  return (data as unknown as GroupRideRow[]).map(rowToGroupRide);
}

export async function scheduleRide(input: {
  groupId: string;
  title: string;
  scheduledAt: number;
  routeId: string | null;
}): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('group_rides').insert({
    group_id: input.groupId,
    title: input.title,
    scheduled_at: new Date(input.scheduledAt).toISOString(),
    route_id: input.routeId,
    created_by: uid,
  });
  if (error) {
    console.warn('[groups/storage] scheduleRide failed', error);
    return false;
  }
  return true;
}
```

- [ ] **Step 2: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors. (If the generated `groups_with_counts` view row types are nullable in unexpected ways, adjust the `as GroupRow[]` cast site — the mapper already tolerates `member_count: null`.)

- [ ] **Step 3: Commit**

```bash
git add lib/groups/storage.ts
git commit -m "feat: add groups storage (CRUD, membership, rides)"
```

## Task 12: GroupsProvider + barrel

**Files:**
- Create: `lib/groups/GroupsProvider.tsx`
- Create: `lib/groups/index.ts`

- [ ] **Step 1: Write the provider**

```tsx
// lib/groups/GroupsProvider.tsx
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
import {
  listMyGroups,
  listDiscoverGroups,
  listUpcomingRides,
} from './storage';
import type { Group, GroupRide } from './types';

/**
 * Holds the signed-in user's group lists and upcoming rides. Reloads when
 * the signed-in user changes (same pattern as ProfileProvider). Screens
 * call `refresh()` after a mutation (join/leave/create/schedule) to re-pull.
 */
type GroupsContextValue = {
  myGroups: Group[];
  discoverGroups: Group[];
  upcomingRides: GroupRide[];
  isHydrated: boolean;
  refresh: () => Promise<void>;
};

const GroupsContext = createContext<GroupsContextValue | null>(null);

export function GroupsProvider({ children }: { children: ReactNode }) {
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [discoverGroups, setDiscoverGroups] = useState<Group[]>([]);
  const [upcomingRides, setUpcomingRides] = useState<GroupRide[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const [mine, discover, rides] = await Promise.all([
      listMyGroups(),
      listDiscoverGroups(),
      listUpcomingRides(),
    ]);
    setMyGroups(mine);
    setDiscoverGroups(discover);
    setUpcomingRides(rides);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    let lastUid: string | null | undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      if (uid === lastUid) return;
      lastUid = uid;
      setIsHydrated(false);
      setMyGroups([]);
      setDiscoverGroups([]);
      setUpcomingRides([]);
      if (!uid) {
        setIsHydrated(true);
        return;
      }
      refresh().catch((e) => {
        console.warn('[GroupsProvider] refresh failed', e);
        setIsHydrated(true);
      });
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo(
    () => ({ myGroups, discoverGroups, upcomingRides, isHydrated, refresh }),
    [myGroups, discoverGroups, upcomingRides, isHydrated, refresh],
  );

  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroups(): GroupsContextValue {
  const ctx = useContext(GroupsContext);
  if (!ctx) {
    throw new Error('useGroups must be used inside <GroupsProvider>.');
  }
  return ctx;
}
```

- [ ] **Step 2: Write the barrel**

```ts
// lib/groups/index.ts
export type { Group, GroupMember, GroupRide, TrainType, MemberRole } from './types';
export { trainTypeLabel } from './types';
export {
  listMyGroups,
  listDiscoverGroups,
  getGroup,
  listMembers,
  createGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  listUpcomingRides,
  listGroupRides,
  scheduleRide,
} from './storage';
export { GroupsProvider, useGroups } from './GroupsProvider';
```

- [ ] **Step 3: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/groups/GroupsProvider.tsx lib/groups/index.ts
git commit -m "feat: add GroupsProvider and groups barrel"
```

## Task 13: wire GroupsProvider + groups stack into app

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add the provider and stack screen**

1. Import: `import { GroupsProvider } from '@/lib/groups';`
2. Nest `GroupsProvider` just inside `RideProvider` (innermost provider, above `<Stack>`):

```tsx
        <RideProvider>
          <GroupsProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="ride" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="goals" />
              <Stack.Screen name="groups" />
            </Stack>
            {/* StatusBar + Toast stay here, inside GroupsProvider */}
          </GroupsProvider>
        </RideProvider>
```

> Keep `StatusBar` and `Toast` exactly where they are relative to the Stack; just ensure they remain inside the provider tree.

- [ ] **Step 2: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: wire GroupsProvider and register groups stack"
```

## Task 14: groups stack layout

**Files:**
- Create: `app/groups/_layout.tsx`

- [ ] **Step 1: Write the layout**

```tsx
// app/groups/_layout.tsx
import { Stack } from 'expo-router';

export default function GroupsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/schedule-ride" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/groups/_layout.tsx
git commit -m "feat: add groups stack layout"
```

## Task 15: rebuild the Groups tab

**Files:**
- Modify: `app/(tabs)/groups.tsx` (full rewrite)

- [ ] **Step 1: Replace the file contents**

```tsx
// app/(tabs)/groups.tsx
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Href, router, useFocusEffect } from 'expo-router';
import { ChevronRight, Plus, Users } from 'lucide-react-native';
import { ElevatedCard } from '@/components/ui/draft';
import { colors, radius, spacing, typography } from '@/theme';
import { useGroups, trainTypeLabel, type Group, type GroupRide } from '@/lib/groups';

const TAB_BAR_SAFE_AREA = 110;

function formatRideWhen(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function GroupStatsRow({ group }: { group: Group }) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>PACE</Text>
        <Text style={styles.statValue}>{group.paceKmh} km/h</Text>
      </View>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>RIDERS</Text>
        <Text style={styles.statValue}>{group.memberCount}</Text>
      </View>
      <View style={styles.statBlock}>
        <Text style={styles.statLabel}>TYPE</Text>
        <Text style={styles.statValue}>{trainTypeLabel(group.trainType)}</Text>
      </View>
    </View>
  );
}

export default function GroupsScreen() {
  const { myGroups, discoverGroups, upcomingRides, refresh } = useGroups();

  // Re-pull whenever the tab regains focus (after create/join/leave/schedule).
  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const openGroup = (id: string) => router.push(`/groups/${id}` as Href);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>GROUPS</Text>
          <Text style={styles.headerSub}>Your riding community</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create group"
          onPress={() => router.push('/groups/create' as Href)}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Plus size={20} color={colors.textOnDark} />
        </Pressable>
      </View>

      {/* MY GROUPS */}
      <Text style={styles.sectionTitle}>MY GROUPS</Text>
      {myGroups.length === 0 ? (
        <ElevatedCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>You haven&apos;t joined any groups yet</Text>
          <Text style={styles.emptyBody}>
            Join one from Discover below, or create your own.
          </Text>
        </ElevatedCard>
      ) : (
        myGroups.map((group) => (
          <ElevatedCard key={group.id} style={styles.trainCard} onPress={() => openGroup(group.id)}>
            <Text style={styles.trainName}>{group.name}</Text>
            <GroupStatsRow group={group} />
          </ElevatedCard>
        ))
      )}

      {/* UPCOMING RIDES */}
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>UPCOMING RIDES</Text>
      {upcomingRides.length === 0 ? (
        <Text style={styles.sectionHint}>No rides scheduled in your groups yet.</Text>
      ) : (
        upcomingRides.map((ride: GroupRide) => (
          <Pressable
            key={ride.id}
            accessibilityRole="button"
            onPress={() => openGroup(ride.groupId)}
            style={({ pressed }) => [styles.groupRow, pressed && styles.groupRowPressed]}
          >
            <View style={styles.groupBody}>
              <Text style={styles.groupName}>{ride.title}</Text>
              <Text style={styles.groupMeta}>
                {ride.groupName} · {formatRideWhen(ride.scheduledAt)}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </Pressable>
        ))
      )}

      {/* DISCOVER */}
      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>DISCOVER</Text>
      <Text style={styles.sectionHint}>Groups you can join</Text>
      <View style={styles.groupList}>
        {discoverGroups.length === 0 ? (
          <Text style={styles.sectionHint}>Nothing new to discover right now.</Text>
        ) : (
          discoverGroups.map((group) => (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              onPress={() => openGroup(group.id)}
              style={({ pressed }) => [styles.groupRow, pressed && styles.groupRowPressed]}
            >
              <View style={styles.groupIcon}>
                <Users size={20} color={colors.textOnDark} />
              </View>
              <View style={styles.groupBody}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>
                  {group.memberCount} riders · {group.paceKmh} km/h · {trainTypeLabel(group.trainType)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['4xl'],
    paddingBottom: TAB_BAR_SAFE_AREA,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  header: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
  },
  headerSub: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginTop: spacing['3xs'],
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: { opacity: 0.85 },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.sm,
  },
  sectionTitleSpaced: { marginTop: spacing['2xl'] },
  sectionHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    marginBottom: spacing.sm,
    opacity: 0.7,
  },
  trainCard: { marginBottom: spacing.sm },
  trainName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.base,
    marginBottom: spacing.sm,
  },
  emptyCard: { marginBottom: spacing.sm },
  emptyTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    marginBottom: spacing['2xs'],
  },
  emptyBody: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statBlock: { flex: 1 },
  statLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
    marginBottom: spacing['3xs'],
  },
  statValue: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
  },
  groupList: {},
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.inactiveOnDark,
  },
  groupRowPressed: { opacity: 0.85 },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBody: { flex: 1 },
  groupName: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size.sm,
    marginBottom: spacing['3xs'],
  },
  groupMeta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
  },
});
```

- [ ] **Step 2: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/groups.tsx"
git commit -m "feat: rebuild Groups tab on Supabase data"
```

## Task 16: create-group screen

**Files:**
- Create: `app/groups/create.tsx`

- [ ] **Step 1: Write the screen**

```tsx
// app/groups/create.tsx
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  InputField,
  PrimaryButton,
  SecondaryButton,
  SegmentedTabs,
} from '@/components/ui/draft';
import { colors, spacing, typography } from '@/theme';
import { createGroup, useGroups, type TrainType } from '@/lib/groups';
import { showToast } from '@/lib/toast';

const TRAIN_TYPES: TrainType[] = ['ROTATING', 'STEADY', 'TEMPO'];

export default function CreateGroupScreen() {
  const { refresh } = useGroups();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pace, setPace] = useState('30');
  const [trainType, setTrainType] = useState<TrainType>('ROTATING');
  const [saving, setSaving] = useState(false);

  const paceNum = Number.parseInt(pace, 10);
  const canSave = name.trim().length > 0 && Number.isFinite(paceNum) && paceNum > 0 && !saving;

  const onSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    const group = await createGroup({
      name: name.trim(),
      description: description.trim() || null,
      paceKmh: paceNum,
      trainType,
    });
    setSaving(false);
    if (!group) {
      showToast({ type: 'error', text1: 'Could not create group', text2: 'Please try again.' });
      return;
    }
    await refresh();
    router.replace(`/groups/${group.id}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>NEW GROUP</Text>

      <InputField label="Name" value={name} onChangeText={setName} placeholder="Dawn Patrol" autoFocus />
      <InputField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Early morning rotating paceline"
      />
      <InputField
        label="Pace (km/h)"
        value={pace}
        onChangeText={(t) => setPace(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
      />

      <Text style={styles.fieldLabel}>TRAIN TYPE</Text>
      <SegmentedTabs options={TRAIN_TYPES} value={trainType} onChange={setTrainType} />

      <View style={styles.actions}>
        <PrimaryButton label={saving ? 'Creating…' : 'Create group'} onPress={onSubmit} disabled={!canSave} />
        <SecondaryButton label="Cancel" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing['4xl'], gap: spacing.lg },
  header: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
```

> Before writing, verify the prop names of `InputField`, `PrimaryButton`, `SecondaryButton`, and `SegmentedTabs` against `components/ui/draft/index.tsx` and the `showToast` signature against `lib/toast.ts`; adjust labels/props to match exactly (e.g. button may take `title` instead of `label`). This is the one spot the plan cannot guarantee prop names — confirm them in the source first.

- [ ] **Step 2: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/groups/create.tsx
git commit -m "feat: add create-group screen"
```

## Task 17: group detail screen

**Files:**
- Create: `app/groups/[id].tsx`

- [ ] **Step 1: Write the screen**

```tsx
// app/groups/[id].tsx
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { PrimaryButton, SecondaryButton } from '@/components/ui/draft';
import { colors, spacing, typography } from '@/theme';
import {
  getGroup,
  listMembers,
  listGroupRides,
  joinGroup,
  leaveGroup,
  deleteGroup,
  trainTypeLabel,
  useGroups,
  type Group,
  type GroupMember,
  type GroupRide,
} from '@/lib/groups';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

function formatRideWhen(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useGroups();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [rides, setRides] = useState<GroupRide[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [g, m, r, auth] = await Promise.all([
      getGroup(id),
      listMembers(id),
      listGroupRides(id),
      supabase.auth.getUser(),
    ]);
    setGroup(g);
    setMembers(m);
    setRides(r);
    setUid(auth.data.user?.id ?? null);
  }, [id]);

  useEffect(() => {
    load().catch((e) => console.warn('[group detail] load failed', e));
  }, [load]);

  if (!group) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.meta}>Loading…</Text>
      </View>
    );
  }

  const isOwner = uid != null && group.ownerId === uid;

  const onJoinLeave = async () => {
    setBusy(true);
    const ok = group.isMember ? await leaveGroup(group.id) : await joinGroup(group.id);
    setBusy(false);
    if (!ok) {
      showToast({ type: 'error', text1: 'Something went wrong', text2: 'Please try again.' });
      return;
    }
    await Promise.all([load(), refresh()]);
  };

  const onDelete = async () => {
    setBusy(true);
    const ok = await deleteGroup(group.id);
    setBusy(false);
    if (!ok) {
      showToast({ type: 'error', text1: 'Could not delete group' });
      return;
    }
    await refresh();
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>{group.name}</Text>
      <Text style={styles.meta}>
        {group.memberCount} riders · {group.paceKmh} km/h · {trainTypeLabel(group.trainType)}
      </Text>
      {group.description ? <Text style={styles.description}>{group.description}</Text> : null}

      <PrimaryButton
        label={busy ? '…' : group.isMember ? 'Leave group' : 'Join group'}
        onPress={onJoinLeave}
        disabled={busy}
      />

      {group.isMember ? (
        <SecondaryButton
          label="Schedule a ride"
          onPress={() => router.push(`/groups/${group.id}/schedule-ride` as Href)}
        />
      ) : null}

      <Text style={styles.sectionTitle}>UPCOMING RIDES</Text>
      {rides.length === 0 ? (
        <Text style={styles.meta}>No upcoming rides.</Text>
      ) : (
        rides.map((ride) => (
          <View key={ride.id} style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{ride.title}</Text>
              <Text style={styles.meta}>{formatRideWhen(ride.scheduledAt)}</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>MEMBERS</Text>
      {members.map((member) => (
        <View key={member.userId} style={styles.row}>
          <Text style={styles.rowTitle}>{member.name}</Text>
          {member.role === 'owner' ? <Text style={styles.ownerTag}>OWNER</Text> : null}
        </View>
      ))}

      {isOwner ? (
        <View style={styles.ownerActions}>
          <SecondaryButton label={busy ? '…' : 'Delete group'} onPress={onDelete} disabled={busy} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingTop: spacing['4xl'], gap: spacing.md },
  header: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
  },
  meta: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.xs,
  },
  description: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.inactiveOnDark,
  },
  rowBody: { flex: 1 },
  rowTitle: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
  },
  ownerTag: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size['2xs'],
    letterSpacing: typography.letterSpacing.wide,
  },
  ownerActions: { marginTop: spacing.xl },
});
```

> Same prop-name caveat as Task 16 — confirm `PrimaryButton`/`SecondaryButton`/`showToast` prop names against source and adjust.

- [ ] **Step 2: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/groups/[id].tsx"
git commit -m "feat: add group detail screen (members, rides, join/leave, delete)"
```

## Task 18: schedule-ride screen

**Files:**
- Create: `app/groups/[id]/schedule-ride.tsx`

- [ ] **Step 1: Write the screen**

```tsx
// app/groups/[id]/schedule-ride.tsx
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { InputField, PrimaryButton, SecondaryButton } from '@/components/ui/draft';
import { colors, radius, spacing, typography } from '@/theme';
import { scheduleRide, useGroups } from '@/lib/groups';
import { useRoutes } from '@/lib/routes';
import { showToast } from '@/lib/toast';

export default function ScheduleRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useGroups();
  const { routes } = useRoutes();
  const [title, setTitle] = useState('');
  // Default to tomorrow 07:00 local; the user can adjust the day offset.
  const [daysAhead, setDaysAhead] = useState('1');
  const [routeId, setRouteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = Number.parseInt(daysAhead, 10);
  const canSave = title.trim().length > 0 && Number.isFinite(days) && days >= 0 && !!id && !saving;

  const onSubmit = async () => {
    if (!canSave || !id) return;
    const when = new Date();
    when.setDate(when.getDate() + days);
    when.setHours(7, 0, 0, 0);
    setSaving(true);
    const ok = await scheduleRide({
      groupId: id,
      title: title.trim(),
      scheduledAt: when.getTime(),
      routeId,
    });
    setSaving(false);
    if (!ok) {
      showToast({ type: 'error', text1: 'Could not schedule ride', text2: 'Please try again.' });
      return;
    }
    await refresh();
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>SCHEDULE RIDE</Text>

      <InputField label="Title" value={title} onChangeText={setTitle} placeholder="Sunday spin" autoFocus />
      <InputField
        label="Days from today"
        value={daysAhead}
        onChangeText={(t) => setDaysAhead(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
      />
      <Text style={styles.fieldHint}>Rides default to 07:00 on the chosen day.</Text>

      <Text style={styles.fieldLabel}>ROUTE (OPTIONAL)</Text>
      <View>
        <Pressable
          onPress={() => setRouteId(null)}
          style={({ pressed }) => [styles.routeChip, routeId === null && styles.routeChipActive, pressed && styles.pressed]}
        >
          <Text style={styles.routeChipText}>No route</Text>
        </Pressable>
        {routes.map((route) => (
          <Pressable
            key={route.id}
            onPress={() => setRouteId(route.id)}
            style={({ pressed }) => [styles.routeChip, routeId === route.id && styles.routeChipActive, pressed && styles.pressed]}
          >
            <Text style={styles.routeChipText}>{route.name}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <PrimaryButton label={saving ? 'Scheduling…' : 'Schedule ride'} onPress={onSubmit} disabled={!canSave} />
        <SecondaryButton label="Cancel" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing['4xl'], gap: spacing.md },
  header: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    fontSize: typography.size['2xl'],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
  },
  fieldHint: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size['2xs'],
    opacity: 0.7,
  },
  routeChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.xs,
  },
  routeChipActive: { borderWidth: 1, borderColor: colors.textOnDark },
  routeChipText: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.size.sm,
  },
  pressed: { opacity: 0.85 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
```

> Same prop-name caveat — confirm component/toast prop names against source.

- [ ] **Step 2: Verify tsc clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/groups/[id]/schedule-ride.tsx"
git commit -m "feat: add schedule-ride screen"
```

## Task 19: full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Tests**

Run: `npx jest`
Expected: all suites pass — existing (`auth/gating`, `profile/mappers`, `ride/mappers`) plus new (`routes/mappers`, `groups/mappers`).

- [ ] **Step 3: Stale-reference sweep**

Run: `grep -rn "ROUTE_CATALOG\|LIVE_TRAINS\|SUGGESTED_GROUPS" app lib | grep -v node_modules`
Expected: no hits (all mocks removed).

- [ ] **Step 4: Lint**

Run: `npx eslint app lib --ext .ts,.tsx` (or the project's `npm run lint` if defined)
Expected: clean, or only pre-existing warnings.

- [ ] **Step 5: Manual e2e (user step, Expo Go)**

Document for the user to run on-device:
1. Sign in. Groups tab → "+" → create a group → lands on detail with you as OWNER.
2. Back to tab → group appears under MY GROUPS; not under DISCOVER.
3. Sign in as a second user (or use another account) → that group shows under DISCOVER → Join → moves to MY GROUPS.
4. Open the group → Schedule a ride → it appears under the group's UPCOMING RIDES and on the tab's UPCOMING RIDES.
5. Leave the group → returns to DISCOVER; rides disappear from the tab UPCOMING list.
6. Explore tab still lists the 3 seeded routes; tapping one opens RouteDetails.

---

## Self-Review

**Spec coverage:**
- routes table + RLS + seed → Task 1 ✓
- routes data layer (mappers/storage/provider) → Tasks 2–5 ✓
- Explore + RouteDetails read from DB → Tasks 6–7 ✓
- groups/group_members/group_rides + view + RLS → Task 8 ✓
- groups data layer → Tasks 9–13 ✓
- MY GROUPS / DISCOVER / UPCOMING RIDES screen logic → Task 15 ✓
- create group / detail+join/leave / schedule ride → Tasks 16–18 ✓
- group detail owner edit/delete → Task 17 (delete ✓; **edit** screen was specced but only delete is built here — see note) 
- tests + tsc + manual e2e → Task 19 ✓

> **Scope note flagged for the executor/user:** the spec mentions owner **Edit** on the detail screen. This plan ships owner **Delete** but defers the Edit form (it reuses the same fields as create; `updateGroup` storage exists and is ready). If Edit is required this iteration, add a `app/groups/[id]/edit.tsx` modeled on `create.tsx` calling `updateGroup`. Confirm with the user whether to include it now or defer.

**Placeholder scan:** no TBD/TODO; all code steps contain full code. The only deliberate "confirm against source" notes are the UI-component prop names (Tasks 16–18) — unavoidable without the component source in hand, and called out explicitly.

**Type consistency:** `rowToGroup(row, isMember)` signature matches its call sites in storage; `findRouteIn(routes, id)` (pure) vs `findRoute(id)` (provider-bound) are distinct names by design; `GroupRideRow`/`GroupMemberRow` join shapes match the `.select()` strings in storage; `member_count: number | null` in the row type matches the mapper's `?? 0`.
