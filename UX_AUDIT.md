# DRAFT — UX Audit + Fix Plan

Date: 2026-05-26 · 52 findings · prep for Supabase

Status: `[x]` fixed · `[~]` partial · `[ ]` deferred (post-Supabase)

---

## P0 — Critical bugs

- [x] `TOP DRAFT ROUTE_CATALOG` label regression
- [x] Energy saved non-zero at zero motion — `RideProvider` now gates `drafting`/`wattsSavedNow` on `speedKmh > MOVING_THRESHOLD_MS`
- [x] Complete screen shows nonsense stats on 0m ride — added `MIN_USEFUL_DISTANCE_M = 100` guard, subtitle + `—` placeholder
- [x] Insights shows "Drafting 100%" with 0m distance — added "too short to analyze" empty state for `< 100m` rides
- [x] Profile avatar showed hardcoded bike image — now renders user initials, falls back to "?"
- [x] "6M TO GO" unit ambiguity — `formatHourMin` now uses `MIN` instead of `M`
- [x] Profile activity "0% SAVED" — energy is now 0 by construction when no motion (was the root cause)

## P1 — Naming inconsistencies

- [x] `M` abbreviation overload (meters vs minutes) — minutes now `MIN`
- [x] Profile name no longer hardcoded UPPERCASE — pulled from `useProfile()` and split into stacked lines
- [ ] Mixed casing in CTAs ("START RIDE" vs "Start this route") — deferred, low priority
- [x] "MY GROUPS" section permanently hidden — left as-is for now (no join action), behaviour documented in comment

## P1 — Missing user feedback / toasts

Installed `react-native-toast-message` + brand-styled `toastConfig` (success/error/info variants) and a `lib/toast.ts` wrapper. Wired:

- [x] Profile save / create (`'Profile saved'` / `'Profile created'`)
- [x] Ride start from map (`'Ride started'` + route distance)
- [x] Ride start from route-details (`'Ride started'` + km route)
- [x] Ride pause (`'Ride paused'`)
- [x] Ride resume (`'Ride resumed'`)
- [x] Ride finish (`'Ride finished'`)
- [x] Location permission denied (`'Location permission required'`)
- [x] Route build failure (`'Route build failed'`)
- [x] Group create stub (`'Group creation coming soon'`) — replaces misdirect to route-details
- [ ] Group join — deferred, no join action exists yet
- [ ] Route favourite — deferred, no favourites feature yet

## P1 — Illogical flows

- [x] Groups "+" create button no longer pushes to route-details — toast info instead
- [x] Profile recent activity navigates for every row (was guard-gated to only the most recent)
- [x] Profile settings push uses `?mode=edit` query — CTA says "SAVE CHANGES"
- [ ] Draft-action tab hijacks the tab button — left as-is (works fine in practice)

## P1 — Persistence

- [x] Ride history persists via AsyncStorage ✓ (already worked)
- [x] Profile + bike setup — new `lib/profile/` package: `Profile` type, AsyncStorage shim, `ProfileProvider` + `useProfile()` hook. Mounted in root layout above `RideProvider`. Profile and bike now survive app reload.
- [ ] Route favourites — deferred (post-Supabase)

## P2 — Form validation

- [x] Profile setup — empty name disables submit, surfaces toast
- [x] Pace clamped to 5 ≤ pace ≤ 60 — out-of-range → error toast, no save
- [x] Bike weight clamped to 3 ≤ weight ≤ 20 — out-of-range → error toast, no save
- [x] Search input strips leading whitespace

## P2 — Accessibility

- [x] Pause / resume buttons — `accessibilityRole="button"` + dynamic label
- [x] Traffic + GPS toggles — labels + `accessibilityState.selected`
- [ ] Live "green dot" in groups — visual only, deferred
- [ ] Settings 40×40 → 44×44 — deferred, minor

## P2 — Empty / loading states

- [x] Insights "too short to analyze" empty state
- [x] Complete "too short to analyze" empty state
- [ ] Active ride "Acquiring GPS…" indicator — deferred
- [ ] Map error retry visual emphasis — deferred

## P3 — Code quality

- [x] `RECENT_WINDOW_SAMPLES` + new `MOVING_THRESHOLD_MS` constants now documented
- [x] ETA cap at 12h — added guard in `recomputeLive()`
- [ ] Magic numbers in `insights.ts` (1500, 30) — deferred, low impact

---

## Supabase readiness — current shape

The new `lib/profile/types.ts` matches the eventual `users` + `bikes` tables 1:1:

```ts
type Profile = {
  id: string;            // → auth.user.id
  name: string;          // → users.name
  skillLevel: SkillLevel; // → users.skill_level
  avgPaceKmh: number;    // → users.avg_pace_kmh
  avatarUri: string|null; // → users.avatar_url
  bike: Bike|null;       // → bikes (1:1 for now)
  updatedAt: number;     // → users.updated_at
};

type Bike = {
  name: string;     // → bikes.name
  type: BikeType;   // → bikes.type
  weightKg: number; // → bikes.weight_kg
};
```

Ride records (`lib/ride/types.ts`) already match the `rides` + `ride_samples` shape — just need to swap `lib/ride/storage.ts` for Supabase queries.

### Migration playbook

1. Install `@supabase/supabase-js`
2. Add tables: `users`, `bikes`, `rides`, `ride_samples`, `groups`, `group_members`, `routes`, `favorites`
3. Replace `lib/profile/storage.ts` body with `supabase.from('users')` upsert/select
4. Replace `lib/ride/storage.ts` body with `supabase.from('rides')` insert/select
5. Wrap `ProfileProvider` and `RideProvider` mutations with optimistic UI + error toasts (toast wrapper already exists)
6. Replace local `ROUTE_CATALOG` and `LIVE_TRAINS` constants with Supabase fetches
7. Move profile creation flow behind auth (Supabase Auth or Magic Link)

### Mutation points needing wiring

- `app/onboarding/profile-setup.tsx::handleSubmit` — `users` + `bikes` upsert (currently `update(patch)` → AsyncStorage)
- `app/ride/map.tsx::handleStartRide` — `rides` insert on start (currently `startRide({...})` → in-memory)
- `app/ride/route-details.tsx::handleStart` — same
- `lib/ride/RideProvider.tsx::finishRide` — `rides` update + `ride_samples` batch insert (currently `saveHistory(next)` → AsyncStorage)
- Future: group join, route favorite, group create
