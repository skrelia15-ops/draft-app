# Apple Health Integration — Design Spec

Date: 2026-06-14
Branch: `feature/supabase-backend-auth`
Status: Approved design, pending implementation plan

## Goal

Bridge DRAFT rides with **Apple HealthKit** (iOS) in both directions:
- **Read:** live heart rate during a ride, and a post-ride summary
  (avg/max heart rate + active calories) pulled from HealthKit.
- **Write:** save each finished ride to HealthKit as a cycling workout
  (time, distance, active energy, avg heart rate).

DRAFT's own tracking (distance, speed, drafting, energy-saved) is
unchanged and remains the source of truth in-app + Supabase. HealthKit is
an **optional bridge**, gated entirely behind the user's explicit consent.

## Scope

In scope:
- iOS only (HealthKit) for this iteration.
- Library: `@kingstinct/react-native-healthkit` (typed, Expo config plugin).
- `lib/health/` package: availability, permissions, live HR hook, post-ride
  summary, workout writer, types.
- `RideRecord.health` optional field + Supabase `rides` columns + mappers.
- UI: live BPM on the active screen; avg/max HR + calories on Complete and
  Insights; a "Connect Apple Health" row + status in Profile.
- Config plugin + usage strings in `app.config.ts`.

Out of scope (separate sub-projects):
- **Android Health Connect** (deferred; second iteration).
- Real rider presence + privacy toggle (feature #3).
- Writing anything other than the cycling workout (no weight/sleep/etc.).

## Platform & build constraints

- **iOS only.** On Android / iPad / Simulator without HealthKit, the
  feature is hidden (`isHealthAvailable() === false`).
- HealthKit needs native code: **does not run in Expo Go.** Requires
  `npx expo prebuild` + a new **dev build** after adding the config plugin.
- **Live heart rate realistically needs an Apple Watch** — iPhone alone
  does not measure HR continuously. Without a Watch, live BPM and HR
  summary are simply absent (fields null → UI shows "—"). This is expected,
  not an error.

## Architecture — `lib/health/`

- `availability.ts` — `isHealthAvailable(): boolean`. Wraps the library's
  availability check; false on non-iOS so all callers no-op safely.
- `types.ts` — pure types, no native imports:
  ```ts
  export type RideHealth = {
    avgHeartRate: number | null;   // bpm
    maxHeartRate: number | null;   // bpm
    activeCalories: number | null; // kcal
  };
  ```
- `permissions.ts`:
  - `requestHealthAuth(): Promise<boolean>` — requests authorization for
    read types (`heartRate`, `activeEnergyBurned`) and write types
    (workout, `distanceCycling`, `activeEnergyBurned`). Returns whether the
    request completed (HealthKit never reveals read-grant status, so we
    treat "request completed" as "asked").
  - `hasAskedHealthAuth()` / `markAskedHealthAuth()` — a small AsyncStorage
    flag so we only auto-prompt once on first ride.
- `summary.ts`:
  - Pure reducer `summarizeSamples(hrSamples, energySamples): RideHealth`
    — avg = mean of HR sample values (rounded), max = max value, calories =
    sum of active-energy sample values (rounded). Empty input → nulls.
    **Unit-tested.**
  - `summarizeRideHealth(startMs, endMs): Promise<RideHealth>` — thin
    wrapper that queries HealthKit samples in the window and calls the pure
    reducer. (Native; not unit-tested.)
- `liveHeartRate.ts` — `useLiveHeartRate(active: boolean): number | null`.
  When `active` and authorized, starts an anchored/observer query for
  `heartRate` and returns the latest bpm; tears down on `active=false` /
  unmount. Returns null when unavailable.
- `write.ts` — `saveRideToHealth(ride: RideRecord): Promise<void>` — writes
  a `cycling` workout: start=`startedAt`, end=`endedAt`, total distance =
  `distanceMeters`, total active energy = `health.activeCalories` (if any),
  metadata avg HR. No-ops if unavailable/denied.
- `index.ts` — barrel.

## Data model

- `RideRecord` (lib/ride/types.ts) gains optional `health?: RideHealth`.
- Supabase `rides` table — add three nullable columns:
  `avg_heart_rate int`, `max_heart_rate int`, `active_calories numeric`.
  - ⚠️ **No `create table rides` migration exists in the repo** — the table
    was created outside migrations (likely the dashboard), yet
    `lib/ride/storage.ts` reads/writes it. The new migration therefore uses
    `alter table public.rides add column if not exists …`, and (like
    `weather_cache`) can be applied via the dashboard SQL editor if
    `db push` doesn't target the live table.
- `lib/ride/mappers.ts` — `rideToRow` writes the three snake_case columns
  from `ride.health`; `rowToRide` reconstructs `health` from them (null when
  all three are null).

## Flow

1. **Ride start (active screen):** if `isHealthAvailable()` and the user
   has authorized (or we prompt once via `requestHealthAuth` on first ever
   ride), mount `useLiveHeartRate(true)` and show the current BPM. No
   auth / no Watch → hide the BPM stat.
2. **Ride finish (`RideProvider.finishRide`):** after the ride is
   summarized and saved (local + Supabase) as today —
   a. `summarizeRideHealth(startedAt, endedAt)` → `RideHealth`;
   b. attach to the saved record (`health`) and persist the update;
   c. `saveRideToHealth(record)` writes the workout.
   Steps a–c are wrapped so any HealthKit failure is non-fatal (the ride is
   already saved); failures surface as a toast only.
3. **Permission entry points:** Profile "Connect Apple Health" row
   (explicit), plus a one-time lazy prompt on first ride start.

## UI

- **Active screen** (`app/ride/active.tsx`): small "BPM" stat showing live
  heart rate when available; omitted otherwise.
- **Complete** (`app/ride/complete.tsx`) and **Insights**
  (`app/ride/insights.tsx`): show avg/max HR and calories from
  `ride.health`; render "—" when a value is null.
- **Profile** (`app/(tabs)/profile.tsx`): an "Apple Health" row — tapping
  requests authorization; shows "Connected" / "Not connected" /, on
  non-iOS, the row is hidden.

## Error handling

- HealthKit unavailable (non-iOS, simulator, iPad) → feature hidden.
- Authorization denied or not granted → live BPM + summary absent, fields
  "—", Profile row reads "Not connected". No blocking, no repeated prompts.
- Empty reads (no Watch / no samples) → nulls → "—".
- Workout write failure → non-fatal toast; ride stays saved.

## Testing

- **Unit (pure, jest):**
  - `summarizeSamples`: HR samples → avg/max; energy samples → kcal sum;
    empty arrays → nulls; single sample; rounding.
  - `mappers`: round-trip a `RideRecord` with `health` set and with
    `health` undefined → columns null.
- Native HealthKit calls (`permissions`, `liveHeartRate`, `summarizeRideHealth`,
  `write`) are mocked in jest and verified manually on a device dev build.

## Risks / notes

- Live HR depends on an Apple Watch; design degrades gracefully without one.
- HealthKit read authorization is opaque (you can't tell if read was
  granted) — we never assume; we just query and handle empty results.
- `rides` table schema drift (no create migration in repo) — handled with
  `add column if not exists` + dashboard-apply fallback.
- New dev build required after adding the config plugin; Expo Go won't show
  the feature.
