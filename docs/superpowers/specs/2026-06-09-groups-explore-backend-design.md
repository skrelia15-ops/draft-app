# Groups & Explore — Supabase backend design

**Date:** 2026-06-09
**Branch:** `feature/supabase-backend-auth`
**Status:** Approved design

## Context

The Supabase migration (auth + profiles + rides + avatar storage) is complete.
Two surfaces were deliberately left as mocks: **Groups** and **Explore**.

- `app/(tabs)/groups.tsx` — hardcoded `LIVE_TRAINS` and `SUGGESTED_GROUPS`
  arrays; tapping any row navigates to a generic `/ride/route-details`. No
  group data model exists.
- `app/(tabs)/explore.tsx` — reads the static `ROUTE_CATALOG` from
  `lib/routes.ts`. Route stats (`riders`, `draftPercent`, …) are hardcoded.

This iteration backs both surfaces with Supabase.

## Scope (this iteration)

- **Groups:** full CRUD + membership. Create / view / join / leave groups.
  Schedule and view upcoming rides.
- **Explore:** move the route catalog into a Supabase `routes` table
  (read-only from the client; admin/seed-managed). No saved/favorite routes,
  no user-published routes.
- **Out of scope:** realtime presence ("who is riding right now"), live GPS
  trains, saved/favorite routes, user-published routes. The old LIVE TRAINS
  section is replaced by **UPCOMING RIDES** (scheduled, not realtime).

## Architecture

Mirror the existing per-domain data-layer pattern used by `lib/profile` and
`lib/ride`: each domain is `types.ts` + `mappers.ts` + `storage.ts` +
`<Domain>Provider.tsx` + `index.ts`, against the typed `supabase` client and
generated `database.types`.

Rejected alternatives: a generic `useSupabaseTable` hook (breaks the existing
pattern, loses type safety); direct supabase calls inside components (no
separation, untestable).

## Data model

### `routes` (Explore catalog — admin/seed-managed)

| column         | type   | notes                                            |
| -------------- | ------ | ------------------------------------------------ |
| `id`           | text PK| keep slugs (`coastal`); route preview geometry seeds off the id |
| `name`         | text   |                                                  |
| `distance_km`  | numeric|                                                  |
| `difficulty`   | text   | `EASY` \| `MODERATE` \| `HARD`                    |
| `shape`        | text   | `loop` \| `out-and-back` \| `point-to-point`      |
| `pace_kmh`     | int    |                                                  |
| `riders`       | int    | static for now                                   |
| `draft_percent`| int    |                                                  |
| `traffic`      | text   | `CLEAR` \| `MODERATE` \| `HEAVY`                  |
| `note`         | text   | nullable                                         |
| `created_at`   | timestamptz | default now()                               |

**RLS:** select for any authenticated user; no client writes (seed migration
inserts the existing 3 routes).

### `groups`

| column        | type   | notes                              |
| ------------- | ------ | ---------------------------------- |
| `id`          | uuid PK| default gen_random_uuid()          |
| `name`        | text   | not null                           |
| `description` | text   | nullable                           |
| `pace_kmh`    | int    |                                    |
| `train_type`  | text   | `ROTATING` \| `STEADY` \| `TEMPO`   |
| `owner_id`    | uuid   | → auth.users, not null             |
| `created_at`  | timestamptz | default now()                 |

**RLS:** select for any authenticated user; insert where
`owner_id = auth.uid()`; update/delete only by the owner.

### `group_members`

| column      | type        | notes                          |
| ----------- | ----------- | ------------------------------ |
| `group_id`  | uuid        | → groups (on delete cascade)   |
| `user_id`   | uuid        | → auth.users                   |
| `role`      | text        | `owner` \| `member`             |
| `joined_at` | timestamptz | default now()                  |
| PK          | (group_id, user_id) |                        |

**RLS:** select for any authenticated user; insert/delete of the caller's own
row (join/leave); the group owner may delete any member row.

### `group_rides` (UPCOMING)

| column        | type        | notes                          |
| ------------- | ----------- | ------------------------------ |
| `id`          | uuid PK     | default gen_random_uuid()      |
| `group_id`    | uuid        | → groups (on delete cascade)   |
| `title`       | text        | not null                       |
| `scheduled_at`| timestamptz | not null                       |
| `route_id`    | text        | → routes, nullable             |
| `created_by`  | uuid        | → auth.users                   |
| `created_at`  | timestamptz | default now()                  |

**RLS:** select for any authenticated user; insert/update/delete by a member
of the group (or the group owner).

### `groups_with_counts` (view)

`groups` joined with `count(group_members)` as `member_count`, so the UI's
`riders` figure is derived rather than denormalized.

## Screen logic

- **MY GROUPS** = groups where the user has a `group_members` row.
- **DISCOVER** = groups the user is *not* in, sorted by `member_count` desc.
- **UPCOMING RIDES** = `group_rides` for the user's groups where
  `scheduled_at >= now()`, ascending by `scheduled_at`.

## Screens & navigation

- **`app/(tabs)/groups.tsx`** (rebuild) — three sections: MY GROUPS (cards),
  UPCOMING RIDES (cards with date/time + group name), DISCOVER (list rows with
  inline Join). Header gains a "+" button → create group. Per-section empty
  states.
- **`app/groups/[id].tsx`** — group detail: header (name, pace, train type,
  member count), this group's UPCOMING RIDES, Join/Leave button.
  Members see "Schedule ride"; the owner sees Delete. (Owner **Edit** is
  deferred to a later iteration — `updateGroup` storage exists and is ready,
  but no Edit form ships this iteration.)
- **`app/groups/create.tsx`** — create form (name, description, pace_kmh,
  train_type). On submit: create the group and add the owner as a
  `group_members` row, then redirect to the detail screen.
- **`app/groups/[id]/schedule-ride.tsx`** — ride form (title, date/time,
  optional route from the catalog). Members only.
- **`app/groups/_layout.tsx`** — stack, card/modal presentation matching the
  existing `app/ride/_layout.tsx`.

## Data layer

### `lib/groups/`

- `types.ts` — `Group`, `GroupRide` domain types + enums
  (`TrainType` reused/shared).

> **Note (implementation):** the named member list was dropped. `profiles`
> RLS only allows reading your own row (`auth.uid() = id`), so other members'
> names/avatars can't be read without a privacy-relevant production RLS
> change. Per product decision only the member **count** (from
> `groups_with_counts`) is shown; the `GroupMember` type, `rowToGroupMember`
> mapper, and `listMembers` storage fn were removed rather than ship a
> silently-broken feature.
- `mappers.ts` — `rowToGroup` / `rowToGroupRide` / etc., with row↔domain
  unit tests (mirrors `lib/profile/mappers.test.ts`).
- `storage.ts` — `listMyGroups`, `listDiscoverGroups`, `getGroup`,
  `createGroup`, `updateGroup`, `deleteGroup`, `joinGroup`, `leaveGroup`,
  `listUpcomingRides`, `scheduleRide`.
- `GroupsProvider.tsx` — holds groups/rides state, reloads on auth-state
  change (same pattern as profile reload).
- `index.ts` — barrel.

### `lib/routes`

- Move `ROUTE_CATALOG` data into the Supabase `routes` table.
- Add a `RoutesProvider` that loads the catalog once at startup and exposes
  `routes` plus a synchronous `findRoute(id)` selector.
- `lib/routes.ts` keeps the `CatalogRoute` type and pure helpers
  (`shapeLabel`, `trafficLabel`, `trafficColor`, `hashIdSeed`); only the
  static array goes away.
- Explore / RouteDetails / Groups read the catalog from context instead of
  importing the constant.
- A seed migration moves the existing 3 routes into the table.

### `app/_layout.tsx`

Add `RoutesProvider` and `GroupsProvider` to the provider tree (under
`AuthProvider`).

## Testing

- Unit tests for new mappers (row↔domain), mirroring profile/ride mapper tests.
- Existing auth gating tests stay green.
- `tsc --noEmit` clean.
- Manual e2e in Expo Go (create group → join/leave → schedule ride →
  see it under UPCOMING) is a user step, like the existing migration e2e.

## Migrations

1. `routes` table + RLS + seed (3 existing routes).
2. `groups`, `group_members`, `group_rides` tables + RLS policies.
3. `groups_with_counts` view.

Apply to the cloud project `draft-app` (ref `fdjeihhtciooahpteign`) and
regenerate `lib/supabase/database.types.ts`.
