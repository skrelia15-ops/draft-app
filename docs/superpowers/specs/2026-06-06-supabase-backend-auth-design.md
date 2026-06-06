# Supabase Backend + Auth — Design

**Date:** 2026-06-06
**Status:** Approved (pending spec review)
**Project:** draft-app (Expo 54 / RN 0.81 / expo-router)
**Supabase project:** `draft-app` (ref `fdjeihhtciooahpteign`, region eu-west-3, Postgres 17)

## Goal

Move the app's user data from on-device AsyncStorage to a Supabase backend and
add mandatory authentication. After this work the app has real accounts, real
cloud-persisted profiles and ride history, and a step-by-step ("one screen, one
action") sign-up + onboarding flow.

## Scope

**In scope:** authentication (email+password, Apple, Google), the `profiles`
domain, and the `rides` (ride history) domain — moved fully to Supabase,
including avatar storage.

**Out of scope (stay as mock/static for now):** the **Groups** tab (live trains,
social) and the **Explore** route catalog. These become separate later
iterations. **Goals** needs no backend work — it is derived from the profile's
`weekly_ride_goal` + ride history.

**No data migration:** existing on-device data is treated as throwaway test
data. After login, data comes from Supabase. Start clean.

## Decisions (locked)

| Topic | Decision |
|---|---|
| Auth methods | Email+password, Apple, Google |
| Access | Auth mandatory — no guest mode, no Skip |
| Sign-up / onboarding UX | "One screen, one action" wizard |
| Launch flow | slides → sign-up/sign-in → profile setup |
| Email confirmation | **Enabled** (wizard has a "check your email" step) |
| Apple/Google | Code written now; credentials + dev build later |
| Avatar | Supabase Storage (private bucket) |
| Bike data | `jsonb` column on `profiles` (1:1, optional) |
| Ride GPS trace | `samples`/`segments` as `jsonb` on the `rides` row |
| Ride history cap | Removed (cloud keeps all; downsampling of trace retained) |
| Unit tests | Yes — add Jest + jest-expo |

## Architecture

The Supabase client becomes the single source of truth. The existing **narrow
storage shims keep their signatures** and are rewritten internally, so screens
and providers change minimally.

**New modules:**
- `lib/supabase/client.ts` — Supabase client (AsyncStorage session storage,
  `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`),
  plus an `AppState` listener to start/stop auto-refresh (per Supabase RN guide).
  Generated DB types via MCP `generate_typescript_types`.
- `lib/auth/AuthProvider.tsx` + `lib/auth/index.ts` — session context exposing
  `session`, `user`, `isLoading`, `signUpWithEmail`, `signInWithEmail`,
  `signInWithApple`, `signInWithGoogle`, `signOut`.

**Launch state machine** (pure function `(session, profile) -> route`, unit-tested):
```
no session                  -> /auth (after slides)
session, no profile row set -> /onboarding/profile (wizard)
session + profile complete  -> /(tabs)
```
Implemented in `app/_layout.tsx` via redirects; remove
`unstable_settings.initialRouteName = 'onboarding'`.

## Flows

### Auth stack — `app/auth/`
"One screen, one action":
```
slides (existing) -> choose (sign in / sign up + Apple/Google buttons)
  sign-up branch: email -> password -> confirm password -> "check your email"
  sign-in branch: email -> password
```

### Profile wizard — `app/onboarding/profile/`
```
name + skill level (one screen) -> bike (optional, skippable) -> done -> /(tabs)
```
- **Pace** (`avgPaceKmh`) and **avatar** are NOT in onboarding. Pace defaults to
  28 (used for ETA fallback); avatar defaults empty. Both are edited later via
  the existing profile-setup screen in `?mode=edit`.
- A lightweight wizard-draft context holds entries across steps; the final step
  writes one `profiles` row.

The existing single-screen [profile-setup.tsx](../../../app/onboarding/profile-setup.tsx)
is retained as the **edit** screen (`?mode=edit`), which already covers name,
skill, pace, avatar, and bike.

## Data model

### `profiles` (1 row per user)
| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | = `auth.users.id`, FK on delete cascade |
| `name` | `text` | |
| `skill_level` | `text` | CHECK in (`'Novice'`,`'Pro'`,`'Elite'`) |
| `avg_pace_kmh` | `int` | default 28 |
| `avatar_url` | `text` null | Storage path |
| `bike` | `jsonb` null | `{ name, type, weightKg }` |
| `weekly_ride_goal` | `int` | default 5, CHECK 1–14 |
| `updated_at` | `timestamptz` | default now() |

### `rides` (1 row per ride)
- Scalar metrics as columns: `started_at`, `ended_at`, `duration_sec`,
  `distance_meters`, `avg_speed_kmh`, `max_speed_kmh`, `drafting_fraction`,
  `energy_saved_percent`, `energy_saved_watts`,
  `potential_extra_energy_percent`, `route_name` (null), `origin` (jsonb null),
  `destination` (jsonb null).
- `samples` `jsonb`, `segments` `jsonb` — the GPS trace and derived segments,
  always read/written together with the ride, so JSONB beats normalization
  (which would create thousands of rows per ride with no query benefit).
- `id` `uuid` PK, `user_id` `uuid` FK -> `auth.users` on delete cascade.

### RLS
Enabled on both tables. Policies for select/insert/update/delete:
- `profiles`: `auth.uid() = id`
- `rides`: `auth.uid() = user_id`

### Auto-create profile
Trigger on `auth.users` insert creates an empty `profiles` row so the
"session, no profile" gate is clean. "Profile complete" is determined by a
non-empty `name`.

### Storage
Private bucket `avatars`, object path `{user_id}/avatar.jpg`. Storage policies
restrict read/write to the owner's folder. Upload via existing
`expo-image-picker` -> `supabase.storage`.

## Code changes

**Rewritten internally (signatures unchanged):**
- [lib/profile/storage.ts](../../../lib/profile/storage.ts) — `loadProfile`/
  `saveProfile` hit `profiles`; `clearProfile` used on sign-out.
- [lib/ride/storage.ts](../../../lib/ride/storage.ts) — `loadHistory`/
  `saveHistory` hit `rides`; remove the 12-ride cap; keep trace downsampling.
- [ProfileProvider](../../../lib/profile/ProfileProvider.tsx) &
  [RideProvider](../../../lib/ride/RideProvider.tsx) — load on session change,
  clear on sign-out.

**Routing:** [app/_layout.tsx](../../../app/_layout.tsx) wraps tree in
`AuthProvider`; redirect-based gating; remove Skip from
[onboarding/index.tsx](../../../app/onboarding/index.tsx).

**Sign-out:** button in [profile tab](../../../app/(tabs)/profile.tsx) ->
`signOut` + clear local providers.

## Auth implementation

- **Email+password:** `signUp` / `signInWithPassword`. Email confirmation
  enabled -> "check your email" step.
- **Apple:** `expo-apple-authentication` -> identity token ->
  `signInWithIdToken({ provider: 'apple', token })`. iOS only.
- **Google:** `@react-native-google-signin/google-signin` -> id token ->
  `signInWithIdToken({ provider: 'google', token })`.

**Constraint:** native Apple/Google sign-in does NOT work in Expo Go — requires
a dev build (`expo run:ios` / EAS) plus OAuth credentials (Apple Service ID,
Google client IDs) configured in Supabase Auth providers. Buttons ship now;
full Apple/Google verification happens after credentials + dev build (separate
instruction). Email works in Expo Go.

## Config & secrets

- `app.config.ts` -> `extra` reads `EXPO_PUBLIC_SUPABASE_URL` +
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env`.
- Fill `.env` with the real `draft-app` URL + publishable key (fetched via MCP).
- **Add `.env` to `.gitignore`** — currently only `.env*.local` is ignored, so
  `.env` would otherwise be committed. (The publishable key is RLS-protected and
  client-safe, but `.env` is still kept out of git as good practice.)
- New packages: `@supabase/supabase-js`, `expo-apple-authentication`,
  `@react-native-google-signin/google-signin`.
- Schema, RLS, trigger, and bucket applied via MCP `apply_migration`.

## Testing

Add Jest + jest-expo (no tests exist yet).

**Unit tests (logic without UI):**
- Row<->type mappers (snake_case DB row <-> camelCase `Profile`/`RideRecord`),
  both directions, including null bike / optional fields.
- Launch-gating state machine `(session, profile) -> route`.

**Manual flow (UI):**
- Full email flow in Expo Go: sign-up -> email -> sign-in -> profile wizard ->
  verify rows appear in Supabase (via MCP `execute_sql`).
- Run MCP `get_advisors` after migrations to confirm RLS is not missing anywhere.
- Apple/Google: buttons present; full run after credentials + dev build.

Per [AGENTS.md](../../../AGENTS.md): verify against
https://docs.expo.dev/versions/v54.0.0/ during implementation.

## Risks / open items

- Apple/Google require external credential setup before they function.
- Email-confirmation deep link back into the app needs a redirect URL / scheme
  configured; for v1 the user can return to the app and sign in manually after
  confirming.
