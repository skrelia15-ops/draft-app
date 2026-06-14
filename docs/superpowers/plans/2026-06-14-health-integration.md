# Apple Health Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge DRAFT rides with Apple HealthKit on iOS — read live heart rate + a post-ride avg/max HR and active-calorie summary, and write each finished ride to Health as a cycling workout.

**Architecture:** A new `lib/health/` package wraps `@kingstinct/react-native-healthkit` behind small, single-purpose modules. Pure logic (sample reducer, types, DB mappers) is unit-tested; native calls are thin wrappers verified on a device dev build. `RideProvider.finishRide` enriches the saved ride asynchronously with health data and writes the workout. UI surfaces values where present and degrades to "—" otherwise.

**Tech Stack:** Expo/React Native, TypeScript, `@kingstinct/react-native-healthkit`, Supabase, Jest (`jest-expo`).

> **⚠️ Native API caveat:** the exact export/call names of `@kingstinct/react-native-healthkit` vary by version. The native-wrapper tasks (6–10) show concrete code targeting the v9 API surface; the implementer MUST confirm the names against the installed version's TypeScript types/README and adjust calls if needed. Our own public interface (`lib/health` exports + `RideHealth`) stays fixed regardless, so the rest of the app and the pure tests are unaffected.

---

## File Structure

- Create `lib/health/types.ts` — `RideHealth` (pure types, no native imports).
- Create `lib/health/summary.ts` — pure `summarizeSamples`, native `summarizeRideHealth`.
- Create `lib/health/availability.ts` — `isHealthAvailable()`.
- Create `lib/health/permissions.ts` — auth request + one-time-asked flag.
- Create `lib/health/liveHeartRate.ts` — `useLiveHeartRate(active)` hook.
- Create `lib/health/write.ts` — `saveRideToHealth(ride)`.
- Create `lib/health/index.ts` — barrel.
- Modify `lib/ride/types.ts` — add `health?: RideHealth` to `RideRecord`.
- Modify `lib/ride/mappers.ts` — health columns in `RideRow` + both mappers.
- Modify `lib/ride/RideProvider.tsx` — async health enrichment on finish.
- Modify `app.config.ts` — HealthKit config plugin + usage strings.
- Create `supabase/migrations/20260614020000_rides_health_columns.sql`.
- Modify `app/ride/active.tsx` — live BPM stat.
- Modify `app/ride/complete.tsx`, `app/ride/insights.tsx` — HR + calories.
- Modify `app/(tabs)/profile.tsx` — "Apple Health" connect row.

---

## Task 1: RideHealth type + RideRecord field

**Files:**
- Create: `lib/health/types.ts`
- Modify: `lib/ride/types.ts`

- [ ] **Step 1: Create the health types**

`lib/health/types.ts`:
```ts
/** Post-ride health metrics pulled from / derived for Apple Health.
 *  All nullable: absent when the user has no Watch, denied access, or is
 *  on a platform without HealthKit. */
export type RideHealth = {
  avgHeartRate: number | null;   // bpm
  maxHeartRate: number | null;   // bpm
  activeCalories: number | null; // kcal
};
```

- [ ] **Step 2: Add the optional field to RideRecord**

In `lib/ride/types.ts`, add an import at the top:
```ts
import type { RideHealth } from '@/lib/health/types';
```
and add this field to the `RideRecord` type (right after `destination?: LatLng;`):
```ts
  /** Optional Apple Health metrics, attached after the ride finishes. */
  health?: RideHealth;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (0 errors).

- [ ] **Step 4: Commit**

```bash
git add lib/health/types.ts lib/ride/types.ts
git commit -m "feat(health): RideHealth type + RideRecord.health field"
```

---

## Task 2: Pure heart-rate / calorie reducer

**Files:**
- Create: `lib/health/summary.ts`
- Test: `lib/health/summary.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/health/summary.test.ts`:
```ts
import { summarizeSamples } from './summary';

test('computes avg (rounded) and max heart rate', () => {
  const r = summarizeSamples([60, 80, 100], []);
  expect(r.avgHeartRate).toBe(80);
  expect(r.maxHeartRate).toBe(100);
  expect(r.activeCalories).toBe(null);
});

test('sums active calories (rounded)', () => {
  const r = summarizeSamples([], [12.4, 30.1, 7.5]);
  expect(r.activeCalories).toBe(50);
  expect(r.avgHeartRate).toBe(null);
  expect(r.maxHeartRate).toBe(null);
});

test('empty input yields all nulls', () => {
  expect(summarizeSamples([], [])).toEqual({
    avgHeartRate: null, maxHeartRate: null, activeCalories: null,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/health/summary.test.ts`
Expected: FAIL — cannot find module `./summary`.

- [ ] **Step 3: Implement the reducer**

`lib/health/summary.ts`:
```ts
import type { RideHealth } from './types';

/** Reduce raw heart-rate (bpm) and active-energy (kcal) sample values into
 *  a RideHealth summary. Pure — no HealthKit access. */
export function summarizeSamples(
  heartRates: number[],
  energies: number[],
): RideHealth {
  const avgHeartRate =
    heartRates.length > 0
      ? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length)
      : null;
  const maxHeartRate =
    heartRates.length > 0 ? Math.round(Math.max(...heartRates)) : null;
  const activeCalories =
    energies.length > 0
      ? Math.round(energies.reduce((a, b) => a + b, 0))
      : null;
  return { avgHeartRate, maxHeartRate, activeCalories };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/health/summary.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/health/summary.ts lib/health/summary.test.ts
git commit -m "feat(health): pure HR/calorie sample reducer"
```

---

## Task 3: DB mapper round-trip for health columns

**Files:**
- Modify: `lib/ride/mappers.ts`
- Test: `lib/ride/mappers.test.ts` (extend existing)

- [ ] **Step 1: Write the failing test (append to existing file)**

Add to `lib/ride/mappers.test.ts`:
```ts
test('round-trips health metrics through the row', () => {
  const withHealth = {
    ...ride,
    health: { avgHeartRate: 142, maxHeartRate: 171, activeCalories: 540 },
  };
  const row = rideToRow(withHealth, 'user-1');
  expect(row.avg_heart_rate).toBe(142);
  expect(row.max_heart_rate).toBe(171);
  expect(row.active_calories).toBe(540);
  expect(rowToRide(row).health).toEqual(withHealth.health);
});

test('omits health when all metrics are null/absent', () => {
  const row = rideToRow(ride, 'user-1'); // `ride` has no health
  expect(row.avg_heart_rate).toBe(null);
  expect(rowToRide(row).health).toBeUndefined();
});
```
(The existing `ride` fixture at the top of the file has no `health`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/ride/mappers.test.ts`
Expected: FAIL — `avg_heart_rate` undefined / type errors.

- [ ] **Step 3: Extend the RideRow type**

In `lib/ride/mappers.ts`, add to the `RideRow` type (after `destination`):
```ts
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  active_calories: number | null;
```

- [ ] **Step 4: Write the health columns in `rideToRow`**

In `rideToRow`'s returned object (after `destination: ...`):
```ts
    avg_heart_rate: r.health?.avgHeartRate ?? null,
    max_heart_rate: r.health?.maxHeartRate ?? null,
    active_calories: r.health?.activeCalories ?? null,
```

- [ ] **Step 5: Reconstruct health in `rowToRide`**

In `rowToRide`, before `return record;`, add:
```ts
  if (
    row.avg_heart_rate != null ||
    row.max_heart_rate != null ||
    row.active_calories != null
  ) {
    record.health = {
      avgHeartRate: row.avg_heart_rate,
      maxHeartRate: row.max_heart_rate,
      activeCalories: row.active_calories,
    };
  }
```

- [ ] **Step 6: Run test + typecheck**

Run: `npx jest lib/ride/mappers.test.ts && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 7: Commit**

```bash
git add lib/ride/mappers.ts lib/ride/mappers.test.ts
git commit -m "feat(health): persist HR/calories through ride mappers"
```

---

## Task 4: rides health columns migration

**Files:**
- Create: `supabase/migrations/20260614020000_rides_health_columns.sql`

> The `rides` table is not created by a repo migration (it was made
> outside migrations). Use `add column if not exists`; this can also be run
> in the dashboard SQL editor if `db push` doesn't reach the live table.

- [ ] **Step 1: Write the migration**

```sql
-- Optional Apple Health metrics attached to a ride after it finishes.
alter table public.rides add column if not exists avg_heart_rate int;
alter table public.rides add column if not exists max_heart_rate int;
alter table public.rides add column if not exists active_calories numeric;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260614020000_rides_health_columns.sql
git commit -m "feat(db): rides health columns"
```

> Apply via `supabase db push` or the dashboard SQL editor (an ops step,
> done by the project owner — not in this task).

---

## Task 5: HealthKit dependency + config plugin

**Files:**
- Modify: `package.json` (via install)
- Modify: `app.config.ts`

- [ ] **Step 1: Install the library**

Run: `npx expo install @kingstinct/react-native-healthkit`
Expected: added to `package.json` dependencies.

- [ ] **Step 2: Add the config plugin + usage strings**

In `app.config.ts`, inside the `plugins: [ ... ]` array, add:
```ts
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'Allow DRAFT to read your heart rate and calories to enrich your ride stats.',
        NSHealthUpdateUsageDescription:
          'Allow DRAFT to save your rides to Apple Health as cycling workouts.',
      },
    ],
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (expect clean).
```bash
git add package.json package-lock.json app.config.ts
git commit -m "chore(health): add react-native-healthkit + config plugin"
```

> **Ops (project owner, not this task):** `npx expo prebuild -p ios` then
> rebuild the dev client. HealthKit will not function in Expo Go.

---

## Task 6: availability wrapper

**Files:**
- Create: `lib/health/availability.ts`

> ⚠️ Confirm the import name against the installed version.

- [ ] **Step 1: Implement**

`lib/health/availability.ts`:
```ts
import { Platform } from 'react-native';
import { isHealthDataAvailable } from '@kingstinct/react-native-healthkit';

/** True only on iOS devices with HealthKit. Everything else no-ops. */
export async function isHealthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await isHealthDataAvailable();
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (expect clean).
```bash
git add lib/health/availability.ts
git commit -m "feat(health): availability check"
```

---

## Task 7: permissions wrapper

**Files:**
- Create: `lib/health/permissions.ts`

> ⚠️ Confirm `requestAuthorization` signature + identifier constants
> against the installed version.

- [ ] **Step 1: Implement**

`lib/health/permissions.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { isHealthAvailable } from './availability';

const ASKED_KEY = '@draft/health/asked/v1';

const READ = [
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
] as const;
const WRITE = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierDistanceCycling',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
] as const;

/** Request HealthKit authorization. Returns false if unavailable. The
 *  iOS read-grant state is intentionally opaque, so a `true` here means
 *  "the prompt completed", not "read was granted". */
export async function requestHealthAuth(): Promise<boolean> {
  if (!(await isHealthAvailable())) return false;
  try {
    await requestAuthorization(WRITE, READ);
    await AsyncStorage.setItem(ASKED_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export async function hasAskedHealthAuth(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === '1';
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (expect clean).
```bash
git add lib/health/permissions.ts
git commit -m "feat(health): authorization request + one-time-asked flag"
```

---

## Task 8: post-ride summary (native query → pure reducer)

**Files:**
- Modify: `lib/health/summary.ts` (add native function below the pure one)

> ⚠️ Confirm `queryQuantitySamples` + the returned sample shape
> (`.quantity` value, unit) against the installed version.

- [ ] **Step 1: Add the native query wrapper**

Append to `lib/health/summary.ts`:
```ts
import { queryQuantitySamples } from '@kingstinct/react-native-healthkit';
import { isHealthAvailable } from './availability';

/** Read HR + active-energy samples for the ride window and reduce them.
 *  Returns all-null on any failure / when unavailable. */
export async function summarizeRideHealth(
  startMs: number,
  endMs: number,
): Promise<RideHealth> {
  if (!(await isHealthAvailable())) {
    return { avgHeartRate: null, maxHeartRate: null, activeCalories: null };
  }
  try {
    const from = new Date(startMs);
    const to = new Date(endMs);
    const hr = await queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
      from, to,
    });
    const energy = await queryQuantitySamples(
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      { from, to },
    );
    return summarizeSamples(
      hr.map((s: { quantity: number }) => s.quantity),
      energy.map((s: { quantity: number }) => s.quantity),
    );
  } catch {
    return { avgHeartRate: null, maxHeartRate: null, activeCalories: null };
  }
}
```
(Keep the existing `import type { RideHealth }` line at the top; move it up if needed so both functions see it.)

- [ ] **Step 2: Verify pure tests still pass + typecheck**

Run: `npx jest lib/health/summary.test.ts && npx tsc --noEmit`
Expected: PASS (the 3 pure tests unaffected), tsc clean.

- [ ] **Step 3: Commit**

```bash
git add lib/health/summary.ts
git commit -m "feat(health): post-ride HealthKit summary query"
```

---

## Task 9: live heart-rate hook

**Files:**
- Create: `lib/health/liveHeartRate.ts`

> ⚠️ The live-sample API differs most across versions. Target: subscribe to
> the most-recent `heartRate` sample while `active`. Confirm the exact
> hook/subscription name (`subscribeToChanges` / `useMostRecentQuantitySample`
> / `queryQuantitySamples` polling) against the installed version and adapt.

- [ ] **Step 1: Implement**

`lib/health/liveHeartRate.ts`:
```ts
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { queryQuantitySamples } from '@kingstinct/react-native-healthkit';

const POLL_MS = 5000;

/** Latest heart rate (bpm) while `active`, or null when unavailable.
 *  Polls the most-recent HR sample; good enough for a live readout and
 *  avoids version-specific subscription APIs. */
export function useLiveHeartRate(active: boolean): number | null {
  const [bpm, setBpm] = useState<number | null>(null);

  useEffect(() => {
    if (!active || Platform.OS !== 'ios') {
      setBpm(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const now = new Date();
        const from = new Date(now.getTime() - 60_000);
        const samples = await queryQuantitySamples(
          'HKQuantityTypeIdentifierHeartRate',
          { from, to: now, limit: 1, ascending: false },
        );
        if (!cancelled && samples.length > 0) {
          setBpm(Math.round(samples[0].quantity));
        }
      } catch {
        // leave previous value
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active]);

  return bpm;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (expect clean).
```bash
git add lib/health/liveHeartRate.ts
git commit -m "feat(health): live heart-rate hook"
```

---

## Task 10: workout writer + barrel

**Files:**
- Create: `lib/health/write.ts`
- Create: `lib/health/index.ts`

> ⚠️ Confirm the save-workout function name + argument shape against the
> installed version (`saveWorkoutSample` / `saveWorkout`).

- [ ] **Step 1: Implement the writer**

`lib/health/write.ts`:
```ts
import { saveWorkoutSample } from '@kingstinct/react-native-healthkit';
import type { RideRecord } from '@/lib/ride';
import { isHealthAvailable } from './availability';

/** Write a finished ride to Health as a cycling workout. No-ops on
 *  failure / when unavailable — never throws to the caller. */
export async function saveRideToHealth(ride: RideRecord): Promise<void> {
  if (!(await isHealthAvailable())) return;
  try {
    await saveWorkoutSample(
      'HKWorkoutActivityTypeCycling',
      [],
      new Date(ride.startedAt),
      new Date(ride.endedAt),
      {
        totalDistance: {
          unit: 'm',
          quantity: ride.distanceMeters,
        },
        totalEnergyBurned:
          ride.health?.activeCalories != null
            ? { unit: 'kcal', quantity: ride.health.activeCalories }
            : undefined,
      },
    );
  } catch {
    // non-fatal; the ride is already saved in-app + Supabase
  }
}
```

- [ ] **Step 2: Create the barrel**

`lib/health/index.ts`:
```ts
export { isHealthAvailable } from './availability';
export { requestHealthAuth, hasAskedHealthAuth } from './permissions';
export { summarizeRideHealth, summarizeSamples } from './summary';
export { useLiveHeartRate } from './liveHeartRate';
export { saveRideToHealth } from './write';
export type { RideHealth } from './types';
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (expect clean).
```bash
git add lib/health/write.ts lib/health/index.ts
git commit -m "feat(health): workout writer + package barrel"
```

---

## Task 11: enrich the ride on finish

**Files:**
- Modify: `lib/ride/RideProvider.tsx` (the `finishRide` callback near line 396–432, and the `saveRide` import on line 17)

- [ ] **Step 1: Import the health helpers**

At the top of `lib/ride/RideProvider.tsx`, add:
```ts
import { summarizeRideHealth, saveRideToHealth } from '@/lib/health';
```

- [ ] **Step 2: Add the async enrichment after the record is built**

In `finishRide`, immediately after the existing `void saveRide(record);`
line, add a fire-and-forget enrichment that updates state + re-saves once
HealthKit returns:
```ts
    void (async () => {
      const health = await summarizeRideHealth(record.startedAt, record.endedAt);
      if (
        health.avgHeartRate == null &&
        health.maxHeartRate == null &&
        health.activeCalories == null
      ) {
        return; // nothing to add (no Watch / denied / non-iOS)
      }
      const enriched: RideRecord = { ...record, health };
      setLastFinished(enriched);
      setHistory((prev) =>
        prev.map((r) => (r.id === enriched.id ? enriched : r)),
      );
      void saveRide(enriched);
      void saveRideToHealth(enriched);
    })();
```
> Use the actual state setter names already in the file. From the context,
> history uses `setHistory`; confirm the "last finished" setter name (e.g.
> `setLastFinished`) by reading the file and match it. If the workout should
> be written even when no read data is available, move the
> `void saveRideToHealth(record)` call out of the null-guard.

- [ ] **Step 3: Typecheck + run ride tests**

Run: `npx tsc --noEmit && npx jest lib/ride`
Expected: clean; existing ride tests still pass.

- [ ] **Step 4: Commit**

```bash
git add lib/ride/RideProvider.tsx
git commit -m "feat(health): enrich finished ride with Health summary + write workout"
```

---

## Task 12: live BPM on the active screen

**Files:**
- Modify: `app/ride/active.tsx`

- [ ] **Step 1: Read the file, then wire the hook**

Add import:
```tsx
import { useLiveHeartRate } from '@/lib/health';
```
Inside `ActiveRideScreen`, after the existing `useRide()` destructure, add
(the ride is live whenever the screen is mounted and not paused):
```tsx
  const bpm = useLiveHeartRate(phase === 'active');
```
(`phase` is already available from `useRide()`.)

- [ ] **Step 2: Render the BPM stat**

In the top stats area (near the SAVED NOW / timer block), add a small stat
that only renders when `bpm` is non-null:
```tsx
        {bpm != null && (
          <Text style={styles.bpm}>{bpm} BPM</Text>
        )}
```
Add a style consistent with the existing dark-screen text (place near
`timer` in the StyleSheet):
```tsx
  bpm: {
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.sm,
    marginTop: spacing['3xs'],
  },
```

- [ ] **Step 3: Typecheck + lint + commit**

Run: `npx tsc --noEmit && npx eslint app/ride/active.tsx`
Expected: clean.
```bash
git add app/ride/active.tsx
git commit -m "feat(active): live heart rate readout"
```

---

## Task 13: HR + calories on Complete and Insights

**Files:**
- Modify: `app/ride/complete.tsx`
- Modify: `app/ride/insights.tsx`

- [ ] **Step 1: Complete — read the file, add health stats**

The finished ride is available from `useRide().lastFinished` (confirm the
exact accessor by reading the file). Where the stat grid renders
DISTANCE / TIME / ENERGY SAVED, add two more cells using the ride's
`health`, rendering `—` when null:
```tsx
        <Stat label="AVG HR" value={ride.health?.avgHeartRate != null ? `${ride.health.avgHeartRate} bpm` : '—'} />
        <Stat label="CALORIES" value={ride.health?.activeCalories != null ? `${ride.health.activeCalories} kcal` : '—'} />
```
> Match the existing stat component/markup in the file (the worktree used a
> `Stat`/grid cell pattern — reuse whatever this screen already defines;
> do not invent a new component).

- [ ] **Step 2: Insights — same treatment**

In `app/ride/insights.tsx`, in the core stats area, add AVG HR / MAX HR /
CALORIES rows from `ride.health`, each showing `—` when null, reusing the
screen's existing stat markup.

- [ ] **Step 3: Typecheck + lint + commit**

Run: `npx tsc --noEmit && npx eslint app/ride/complete.tsx app/ride/insights.tsx`
Expected: clean.
```bash
git add app/ride/complete.tsx app/ride/insights.tsx
git commit -m "feat(insights): show heart rate + calories when available"
```

---

## Task 14: "Connect Apple Health" row in Profile

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Wire availability + a connect handler**

Add imports:
```tsx
import { useEffect, useState } from 'react'; // useState/useEffect already imported — merge, don't duplicate
import { isHealthAvailable, requestHealthAuth } from '@/lib/health';
import { Platform } from 'react-native';
```
Inside `ProfileScreen`:
```tsx
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [healthAsked, setHealthAsked] = useState(false);
  useEffect(() => {
    isHealthAvailable().then(setHealthAvailable);
  }, []);

  const connectHealth = async () => {
    const ok = await requestHealthAuth();
    setHealthAsked(ok);
    toast[ok ? 'success' : 'error'](
      ok ? 'Apple Health connected' : 'Could not connect Apple Health',
    );
  };
```

- [ ] **Step 2: Render the row (iOS + available only)**

Below the BIKE SETUP section, add:
```tsx
      {healthAvailable && (
        <>
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>APPLE HEALTH</Text>
          <Pressable style={styles.activityCard} onPress={connectHealth} accessibilityRole="button">
            <View style={styles.activityIcon}>
              <Bolt size={20} color={colors.textOnDark} />
            </View>
            <View style={styles.activityBody}>
              <Text style={styles.activityName}>
                {healthAsked ? 'CONNECTED' : 'CONNECT APPLE HEALTH'}
              </Text>
              <Text style={styles.activityInfo}>
                Sync rides + read heart rate and calories
              </Text>
            </View>
          </Pressable>
        </>
      )}
```
> Reuse existing styles (`activityCard`, `activityIcon`, `activityBody`,
> `activityName`, `activityInfo`, `sectionTitle`, `sectionTitleSpaced`) and
> an already-imported icon. Don't add new icon imports unless needed.

- [ ] **Step 3: Typecheck + lint + commit**

Run: `npx tsc --noEmit && npx eslint "app/(tabs)/profile.tsx"`
Expected: clean.
```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat(profile): connect Apple Health row"
```

---

## Task 15: Final verification

**Files:** none (verification)

- [ ] **Step 1: Full gate**

Run: `npx jest && npx tsc --noEmit && npm run lint`
Expected: all suites pass, tsc clean, lint clean (warnings OK).

- [ ] **Step 2: On-device checklist (project owner, dev build)**

After `npx expo prebuild -p ios` + rebuilding the dev client on a physical
iPhone (ideally paired with an Apple Watch):
- Profile → "Connect Apple Health" shows the iOS permission sheet.
- Start a ride → live BPM appears (with a Watch).
- Finish → Complete/Insights show avg/max HR + calories; the ride appears
  in Apple Health as a cycling workout.
- On Simulator / no Watch: feature is hidden or shows "—", nothing crashes.

---

## Self-Review Notes

- **Spec coverage:** `lib/health/` package (T1,T2,T6–T10), RideHealth +
  RideRecord (T1), mappers + migration (T3,T4), config plugin/build (T5),
  finish enrichment (T11), live BPM (T12), Complete/Insights UI (T13),
  Profile connect row (T14), tests on pure functions (T2,T3). Both
  directions (read summary + live, write workout) covered.
- **Type consistency:** `RideHealth { avgHeartRate, maxHeartRate,
  activeCalories }` used identically in types, summary, mappers, write, UI.
  `summarizeSamples(heartRates, energies)` and `summarizeRideHealth(startMs,
  endMs)` signatures stable across tasks.
- **Native API caveat** is flagged once up top and on each native task
  (6–10) — the implementer confirms exact `@kingstinct/react-native-healthkit`
  call names against the installed version; our public interface is fixed.
- **Ops steps** (`expo prebuild` + dev build, `db push`/dashboard for the
  migration) are explicitly the project owner's, not implementer tasks.
- **Reading-before-editing:** tasks touching existing screens/provider tell
  the implementer to read the file first and match existing setter names,
  stat components, and styles rather than invent new ones.
