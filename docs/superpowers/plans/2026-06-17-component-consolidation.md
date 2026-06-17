# Component & Token Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralise all reusable UI into `components/`, add missing design tokens, and break up the map/insights/active god-files — with zero change to runtime behaviour or visual appearance.

**Architecture:** Pure refactor. Move existing JSX/styles verbatim into focused files; introduce shared primitives only where screens currently duplicate them; the public import surface `@/components/ui/draft` stays identical via a barrel. Verification is `tsc --noEmit` + existing Jest tests after every task; no visual change is permitted.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, expo-router, react-native-maps.

**Spec:** `docs/superpowers/specs/2026-06-17-component-consolidation-design.md`

**Global verification command (run after every task):**
```bash
cd /Users/viola/draft-app && npx tsc --noEmit -p tsconfig.json && npx jest --silent 2>&1 | tail -5
```
Expected: tsc prints nothing (clean); jest shows all suites passing.

---

## Task 1: Add semantic + surface tokens

**Files:**
- Modify: `theme/colors.ts:30-38`

- [ ] **Step 1: Add tokens to the `colors` object**

Insert before the `// Raw` block in `theme/colors.ts`:

```ts
  // Status (semantic) — previously hardcoded as #3FBF6E/#F2A93B/#E5484D
  success: '#3FBF6E',
  warning: '#F2A93B',
  danger: '#E5484D',

  // Hairline borders on dark cards — previously rgba(255,255,255,0.06|0.08)
  hairline: 'rgba(255,255,255,0.06)',
  hairlineStrong: 'rgba(255,255,255,0.08)',

  // Modal/overlay scrim — previously rgba(17,17,17,0.6)
  scrim: 'rgba(17,17,17,0.6)',
```

- [ ] **Step 2: Verify & commit**

Run global verification. Then:
```bash
git add theme/colors.ts
git commit -m "feat(theme): add status, hairline, and scrim tokens"
```

---

## Task 2: `statusColor()` helper + migrate status hardcodes

Two files define an identical `riderColor()` and the traffic palette is inline. Unify.

**Files:**
- Create: `lib/ride/statusColor.ts`
- Modify: `lib/ride/index.ts` (add export)
- Modify: `app/ride/map.tsx:687-692` (riderColor), `app/ride/map.tsx:1060-1062` (traffic)
- Modify: `app/(tabs)/index.tsx:276-279` (riderColor)

- [ ] **Step 1: Create the helper**

`lib/ride/statusColor.ts`:
```ts
import { colors } from '@/theme';
import type { DraftPotential } from './proximity';

/** Status hue for a rider's draft potential — HIGH=green, MEDIUM=amber, else muted. */
export function draftPotentialColor(potential: DraftPotential): string {
  if (potential === 'HIGH') return colors.success;
  if (potential === 'MEDIUM') return colors.warning;
  return colors.textMuted;
}

/** Traffic-level hue — CLEAR=green, MODERATE=amber, HEAVY/other=red. */
export function trafficColor(level: 'CLEAR' | 'MODERATE' | 'HEAVY'): string {
  if (level === 'CLEAR') return colors.success;
  if (level === 'MODERATE') return colors.warning;
  return colors.danger;
}
```

- [ ] **Step 2: Export from the ride barrel**

Add to `lib/ride/index.ts`:
```ts
export { draftPotentialColor, trafficColor } from './statusColor';
```
> Note: `trafficColor` already exists in `lib/ride/utils.ts` for a different concept (traffic *weight* color by `TrafficLevel`). Confirm names don't collide — if `utils.ts` already exports `trafficColor`, name the new one `trafficLevelColor` instead and use that everywhere in Step 3-4.

- [ ] **Step 3: Replace in `app/ride/map.tsx`**

Delete the local `riderColor` function (lines ~687-692) and the inline traffic ternary (lines ~1060-1062). Import and use `draftPotentialColor` / the traffic helper. `riderColor(rider.potential)` → `draftPotentialColor(rider.potential)`; the `traffic` memo returns `{ level, color: trafficLevelColor(level) }`.

- [ ] **Step 4: Replace in `app/(tabs)/index.tsx`**

Delete the local `riderColor` (lines ~276-279) and use `draftPotentialColor` from `@/lib/ride`.

- [ ] **Step 5: Verify & commit**

Run global verification (confirm map + home still typecheck). Then:
```bash
git add lib/ride/statusColor.ts lib/ride/index.ts app/ride/map.tsx "app/(tabs)/index.tsx"
git commit -m "refactor(ride): single statusColor helper, drop duplicated riderColor"
```

---

## Task 3: Hairline / scrim token sweep

**Files (modify):** every file with `rgba(255,255,255,0.06)`, `rgba(255,255,255,0.08)`, or `rgba(17,17,17,0.…)` in a style. Known: `components/ui/draft/index.tsx`, `app/profile-setup.tsx:445`, `app/(tabs)/explore.tsx:361`, `app/ride/route-details.tsx:464`, `app/ride/map.tsx:1601`, plus any found by grep.

- [ ] **Step 1: Find every occurrence**

```bash
grep -rnE "rgba\(255,255,255,0\.0[68]\)|rgba\(17,17,17," app components --include="*.tsx"
```

- [ ] **Step 2: Replace mechanically**

- `'rgba(255,255,255,0.06)'` → `colors.hairline`
- `'rgba(255,255,255,0.08)'` → `colors.hairlineStrong`
- `'rgba(17,17,17,0.6)'` → `colors.scrim` (the `0.5` web variant in map.tsx may stay inline — it is a Platform.OS branch; leave the ternary but swap the native arm to `colors.scrim`).

Ensure each touched file imports `colors` from `@/theme` (most already do).
> Leave `rgba(241,241,241,0.3)` (muted-text-on-dark) and `rgba(246,235,76,0.25)` (primary border) as-is — out of scope for this task.

- [ ] **Step 3: Verify & commit**

Run global verification + visually confirm nothing else changed:
```bash
grep -rnE "rgba\(255,255,255,0\.0[68]\)" app components --include="*.tsx"   # expect: no output
git add -A && git commit -m "refactor(theme): use hairline/scrim tokens instead of inline rgba"
```

---

## Task 4: Split the design-system barrel into per-component files

Move each component + its style slice out of `components/ui/draft/index.tsx` into its own file, then turn `index.tsx` into a pure re-export barrel. The public path `@/components/ui/draft` is unchanged, so **no screen imports change**.

**Shared module first** (used by several components):

**Files:**
- Create: `components/ui/draft/_shared.ts`

- [ ] **Step 1: Create `_shared.ts` with the cross-component primitives**

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export const ui = {
  softShadow: {
    shadowColor: colors.black,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

export const cardBase = {
  backgroundColor: colors.surfaceElevated,
  borderRadius: radius.xl,
  padding: spacing.md,
  borderWidth: 1,
  borderColor: colors.hairline,
} as const;

export const pressedStyle = StyleSheet.create({ pressed: { opacity: 0.88 } }).pressed;
```

- [ ] **Step 2: Create `Card.tsx`**

Move `CardProps`, `CardShell`, `TabBar`, `ElevatedCard`, `PrimaryCard`, `HighlightCard`, `ListItemCard`, `ListItemCardProps` and their style keys (`tabBar`, `elevatedCard`, `primaryCard`, `highlightCard`, `listItemCard`, `listLeading`, `listBody`, `listTrailing`) into `components/ui/draft/Card.tsx`. Import `cardBase`, `pressedStyle` from `./_shared`; import `colors, radius, spacing` from `@/theme`. Export `CardProps` too (it is reused by `ListItemCard`). Replace `styles.pressed` references with `pressedStyle`.

- [ ] **Step 3: Create `StatCard.tsx`**

Move `StatCardProps`, `StatCard`, and style keys `statCard/statLabel/statValue/statValueAccent/statContext` into `components/ui/draft/StatCard.tsx`.

- [ ] **Step 4: Create `IconButton.tsx`**

Move `IconButtonProps`, `IconButton`, styles `iconButton/iconButtonSelected/iconButtonDisabled`. Use `pressedStyle` for the pressed arm.

- [ ] **Step 5: Create `InputField.tsx`**

Move `InputFieldProps`, `InputField` (keep `forwardRef`), styles `inputLabel/inputShell/inputShellActive/inputLeading/inputTrailing/input`.

- [ ] **Step 6: Create `Button.tsx`**

Move `ButtonProps`, `PrimaryButton`, `SecondaryButtonProps`, `SecondaryButton`, styles `primaryButton*/secondaryButton*`. Use `pressedStyle`.

- [ ] **Step 7: Create `Segmented.tsx`**

Move `SegmentedTabsProps`, `SegmentedTabs`, `SegmentedProgressProps`, `SegmentedProgress`, and styles `segmented*` + `segmentRow/segmentCell/segmentBar*/segmentLabel*`. Use `pressedStyle`.

- [ ] **Step 8: Rewrite `index.tsx` as a barrel**

Replace the entire contents of `components/ui/draft/index.tsx` with:
```ts
export { ui } from './_shared';
export { GoalsCard, buildGoalDays, type Goal } from './GoalsCard';
export { TabBar, ElevatedCard, PrimaryCard, HighlightCard, ListItemCard, type CardProps } from './Card';
export { StatCard } from './StatCard';
export { IconButton } from './IconButton';
export { InputField } from './InputField';
export { PrimaryButton, SecondaryButton } from './Button';
export { SegmentedTabs, SegmentedProgress } from './Segmented';
```

- [ ] **Step 9: Verify & commit**

Run global verification — every screen importing `@/components/ui/draft` must still typecheck unchanged.
```bash
git add components/ui/draft
git commit -m "refactor(ui): split design-system barrel into per-component files"
```

---

## Task 5: `AvatarRing` primitive + migrate two screens

`app/(tabs)/profile.tsx` and `app/profile-setup.tsx` both render an avatar ring (image-or-initials) with slightly different sizes/badges.

**Files:**
- Create: `components/ui/draft/AvatarRing.tsx`
- Modify: `components/ui/draft/index.tsx` (export), `app/(tabs)/profile.tsx`, `app/profile-setup.tsx`

- [ ] **Step 1: Create `AvatarRing.tsx`**

```tsx
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, typography } from '@/theme';

type AvatarRingProps = {
  /** Renderable image URI, or null to show initials. */
  uri: string | null;
  /** Fallback initials shown when `uri` is null. */
  initials: string;
  /** Outer diameter in px. */
  size: number;
  /** Ring border colour. Defaults to the brand primary. */
  ringColor?: string;
  /** Ring border width. Defaults to 3. */
  ringWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/** Circular avatar: photo when available, capitalised initials otherwise. */
export function AvatarRing({ uri, initials, size, ringColor = colors.primary, ringWidth = 3, style }: AvatarRingProps) {
  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderColor: ringColor, borderWidth: ringWidth },
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.3 }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  initials: {
    color: colors.textOnDark,
    fontFamily: typography.fontFamily.extrabold,
    fontStyle: 'italic',
    letterSpacing: typography.letterSpacing.wide,
  },
});
```
> The badge (Bolt / Camera) stays in each screen as an absolutely-positioned overlay sibling — only the ring+image+initials is shared. This keeps the primitive single-purpose.

- [ ] **Step 2: Export it**

Add to `components/ui/draft/index.tsx`:
```ts
export { AvatarRing } from './AvatarRing';
```

- [ ] **Step 3: Migrate `app/(tabs)/profile.tsx`**

Replace the `styles.avatarRing` View (lines ~137-148) with `<AvatarRing uri={avatarDisplayUri} initials={avatarInitials(profile.name)} size={80} />`. Keep the `avatarWrap` wrapper and `avatarBadge`. Delete now-unused styles `avatarRing/avatarImage/avatarInitials`.

- [ ] **Step 4: Migrate `app/profile-setup.tsx`**

Replace the `styles.avatarRing` View (lines ~252-258) with `<AvatarRing uri={displayUri} initials={initials} size={AVATAR_SIZE} ringColor={colors.hairlineStrong} ringWidth={2} />`. Keep `avatarWrap`/`avatarEditBadge`. Delete unused styles `avatarRing/avatarImage/avatarInitials`.
> Visual check: profile-setup ring used `borderColor: 'rgba(255,255,255,0.08)'` width 2 — that is `colors.hairlineStrong`, width 2. Profile used `colors.primary` width 3 (the default). Confirm both render identically to before.

- [ ] **Step 5: Verify & commit**

```bash
git add components/ui/draft "app/(tabs)/profile.tsx" app/profile-setup.tsx
git commit -m "refactor(ui): shared AvatarRing; drop duplicated avatar markup"
```

---

## Task 6: Extend `StatCard` / add `StatRow` + migrate stat blocks

Four screens hand-roll a label+value stat block. Map them onto `StatCard` (vertical) where the markup matches; for the bordered `StatRow` in route-details add a row variant.

**Files:**
- Modify: `components/ui/draft/StatCard.tsx`, `index.tsx`
- Modify: `app/goals/index.tsx` (`Stat`), `app/ride/insights.tsx` (`CoreStat`), `app/(tabs)/index.tsx` (`CompatBar` — assess), `app/ride/route-details.tsx` (`StatRow`)

- [ ] **Step 1: Inspect each call-site before changing anything**

```bash
sed -n '225,270p' "app/goals/index.tsx"; sed -n '266,310p' app/ride/route-details.tsx; sed -n '272,300p' app/ride/insights.tsx; sed -n '258,290p' "app/(tabs)/index.tsx"
```
Decide per component: if its markup/styles are pixel-identical to `StatCard`, replace with `StatCard`; if not, leave it local and note why in the commit body. **Do not alter appearance to force a match.** `CompatBar` is a labelled progress bar, not a stat block — likely leave it local (out of scope).

- [ ] **Step 2: Migrate the matching ones**

For each stat block whose look matches, replace the local component usage with `<StatCard label=… value=… />` and delete the local function + its styles. Only migrate genuine matches.

- [ ] **Step 3: Verify & commit**

```bash
git add -A
git commit -m "refactor(ui): use shared StatCard for matching stat blocks"
```

---

## Task 7: `Tag` + `Chip` primitives + migrate

**Files:**
- Create: `components/ui/draft/Tag.tsx`, `components/ui/draft/Chip.tsx`
- Modify: `index.tsx`, `app/ride/route-details.tsx` (`Tag`), `app/profile-setup.tsx` (skill/bike chips)

- [ ] **Step 1: Create `Tag.tsx`** by moving the `Tag` component + styles out of `app/ride/route-details.tsx:295-…` verbatim into `components/ui/draft/Tag.tsx`, exporting `Tag` and its `{ icon, label }` props.

- [ ] **Step 2: Create `Chip.tsx`** from the profile-setup chip markup (`styles.chip/chipActive/chipText/chipTextActive`, lines ~471-490). Props: `{ label: string; active: boolean; onPress: () => void }`. Move the styles verbatim.

- [ ] **Step 3: Export both** from `index.tsx`:
```ts
export { Tag } from './Tag';
export { Chip } from './Chip';
```

- [ ] **Step 4: Migrate call-sites** — route-details uses `<Tag …>` from the barrel (delete local copy); profile-setup's two `.map` chip blocks render `<Chip label={level} active={skill === level} onPress={() => setSkill(level)} />` and the bike-type equivalent. Delete the local chip styles.

- [ ] **Step 5: Verify & commit**

```bash
git add -A
git commit -m "refactor(ui): shared Tag and Chip primitives"
```

---

## Task 8: Split `app/ride/map.tsx` into `components/map/*`

map.tsx is 1676 lines. Extract the leaf subcomponents and geo-helpers into `components/map/` (NOT `app/`, which Expo Router would treat as routes). The screen keeps state, effects, and the `<MapView>` container.

**Files:**
- Create: `components/map/markers.tsx`, `components/map/PermissionGate.tsx`, `components/map/PredictionsList.tsx`, `components/map/InputRow.tsx`, `components/map/RouteSummary.tsx`, `components/map/BottomSheet.tsx`
- Modify: `app/ride/map.tsx`

- [ ] **Step 1: Extract geo-helpers + marker visuals**

Move `compassBearing`, `offsetCoords` (pure functions, lines ~648-685) and the rider/origin/dest pin **styles** into `components/map/markers.tsx`. Export the helpers. Keep marker JSX inline in the screen for now (it reads `riderBase`, `nearbyRiders` from state) OR export a `<RiderMarkers riders origin destination>` component if clean — prefer moving just helpers + styles first to limit risk.

- [ ] **Step 2: Extract `PermissionGate`** (lines ~698-752) into `components/map/PermissionGate.tsx` with its style slice (`permission*`). It already takes all data via props.

- [ ] **Step 3: Extract `PredictionsList`** (~1000-1043) + `InputRow` (~938-998) into their files with style slices (`predictions*`, `inputField*`, `inputDot*`, `inputText`, `inputAction`).

- [ ] **Step 4: Extract `RouteSummary`** (~1045-1141) into `components/map/RouteSummary.tsx` with styles `stats*/meta*/traffic*/fallback*`. Use the `trafficLevelColor` helper from Task 2 instead of the inline palette.

- [ ] **Step 5: Extract `BottomSheet`** (~779-936) + its `BottomSheetProps` into `components/map/BottomSheet.tsx`, importing `InputRow`, `PredictionsList`, `RouteSummary` from siblings. Move styles `sheet*/swap*/summarySpacer/errorRow/errorText/errorRetry/startButton*`.

- [ ] **Step 6: Trim the screen**

`app/ride/map.tsx` keeps `RideMapScreen`, state, effects, the `<MapView>` + markers, and imports the extracted pieces. Move each component's styles out of the screen `StyleSheet` as you go (the screen keeps only the styles it still references: `root/topArea/iconButton/pickBanner*/sideStack/sideButton*` + marker/pin styles if markers stayed inline).

- [ ] **Step 7: Verify & commit**

Run global verification. Manually confirm the map screen renders (dev build) — search, pick-on-map, route build, start ride.
```bash
git add app/ride/map.tsx components/map
git commit -m "refactor(map): split map.tsx into components/map subcomponents"
```

---

## Task 9: Split `app/ride/insights.tsx` into `components/insights/*`

**Files:**
- Create: `components/insights/ComparisonBadge.tsx`, `components/insights/SplitBar.tsx`, `components/insights/SegmentTimeline.tsx` (includes `SegmentCallout`)
- Modify: `app/ride/insights.tsx`

- [ ] **Step 1:** If `CoreStat` matches `StatCard`, replace it (per Task 6 rule); otherwise leave local.
- [ ] **Step 2:** Move `ComparisonBadge` (~305-335) + styles into its file.
- [ ] **Step 3:** Move `SplitBar` (~336-356) + styles into its file.
- [ ] **Step 4:** Move `SegmentTimeline` (~357-…) and `SegmentCallout` (~377-…) + styles into `SegmentTimeline.tsx` (callout is only used by the timeline).
- [ ] **Step 5:** Import them back into `insights.tsx`; move the corresponding style keys out of the screen.
- [ ] **Step 6: Verify & commit**
```bash
git add app/ride/insights.tsx components/insights
git commit -m "refactor(insights): extract insights subcomponents"
```

---

## Task 10: Split `app/ride/active.tsx` into `components/active/*`

**Files:**
- Create: `components/active/EfficiencyGauge.tsx`, `components/active/PauseOverlay.tsx`
- Modify: `app/ride/active.tsx`

- [ ] **Step 1:** Move `EfficiencyGauge` (~30-…) + its styles into `components/active/EfficiencyGauge.tsx`. It takes `{ percent }` — confirm no other screen-state closure; pass everything via props.
- [ ] **Step 2:** Move `PauseOverlay` (~300-…) + styles into `components/active/PauseOverlay.tsx`.
- [ ] **Step 3:** Import both back; move style keys out of the screen.
- [ ] **Step 4: Verify & commit**
```bash
git add app/ride/active.tsx components/active
git commit -m "refactor(active): extract EfficiencyGauge and PauseOverlay"
```

---

## Task 11: Final verification sweep

- [ ] **Step 1:** `npx tsc --noEmit -p tsconfig.json` → clean.
- [ ] **Step 2:** `npx jest` → all suites pass.
- [ ] **Step 3:** Confirm no stray duplicates remain:
```bash
grep -rnE "function riderColor|rgba\(255,255,255,0\.0[68]\)" app components --include="*.tsx"   # expect: no output
```
- [ ] **Step 4:** Manual dev-build pass (`npx expo run:ios`) over: profile, profile-setup, explore, route-details, map, insights, active, goals, home — confirm every screen looks identical to pre-refactor.
- [ ] **Step 5:** Push:
```bash
git push origin feature/supabase-backend-auth
```

---

## Self-review notes

- **Spec coverage:** §1 tokens → T1; §1 status helper → T2; §1 hairline/scrim → T3; §2 barrel split → T4; §3 primitives → T5 (Avatar), T6 (Stat), T7 (Tag/Chip); §4 god-files → T8 (map), T9 (insights), T10 (active); §5 ordering → task order; verification → T11. All covered.
- **Behaviour-preserving:** every task moves code verbatim or maps onto a pixel-identical primitive; the only value swaps are token aliases for the same literal (e.g. `colors.hairline` === `rgba(255,255,255,0.06)`).
- **Naming risk flagged:** Task 2 Step 2 guards against an existing `trafficColor` in `lib/ride/utils.ts` (rename to `trafficLevelColor` if collision).
- **Expo Router risk flagged:** Task 8 puts subcomponents in `components/map/`, never `app/`.
