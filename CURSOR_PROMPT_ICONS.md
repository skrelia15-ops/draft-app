# Cursor Prompt — Fix tab bar icons and remove visible "strokes"

## Project context

React Native + Expo Router app called DRAFT (cycling drafting tracker). You are working in this repository. Dark theme `#111111`, yellow accent `#F6EB4C`. The design target is a Calorie-Tracker-style aesthetic: a floating white pill tab bar, the active icon wrapped in a small yellow circle, inactive icons dark. Everything should read as **solid filled silhouettes with no visible inner lines / outlines / strokes inside the icon glyph**.

## Root cause of the problem

The project uses `@solar-icons/react-native`. Even the `/Bold` variant of several icons (`Pulse2`, `Map`, `UsersGroupTwoRounded`, `Compass`, etc.) is built from multiple separate SVG `<Path>` elements. Tiny transparent gaps remain between those paths, and on screen those gaps read as **internal strokes / outlines** — especially visible on the yellow active background. This is a property of the icon set and cannot be fixed via props.

**Fix: replace Solar Icons with Lucide React Native** in the tab bar and other high-visibility places. Lucide icons are single-path stroke-only glyphs that can be turned into clean filled silhouettes by passing `fill={color} strokeWidth={0}`.

## Tasks

### Step 1. Install Lucide

```bash
npx expo install lucide-react-native react-native-svg
```

(`react-native-svg` is already installed — verify in `package.json` and don't duplicate.)

### Step 2. Rewrite the tab bar

File: `app/(tabs)/_layout.tsx`

Replace all Solar imports with Lucide imports. Use `fill={color} strokeWidth={0}` for every tab icon so it renders as a solid silhouette with no internal lines:

```tsx
import { Home, Compass, Users, User, Zap } from 'lucide-react-native';

// Inside tabBarIcon for each Tabs.Screen:
<Home    size={24} color={color}            fill={color}            strokeWidth={0} />
<Compass size={24} color={color}            fill={color}            strokeWidth={0} />
<Users   size={24} color={color}            fill={color}            strokeWidth={0} />
<User    size={24} color={color}            fill={color}            strokeWidth={0} />

// Center ride button (currently Bolt from Solar):
<Zap size={26} color={textOnPrimary} fill={textOnPrimary} strokeWidth={0} />
```

### Step 3. Tab bar structure

The layout must be:

- White pill: `backgroundColor: '#FFFFFF'`, `borderRadius: 28`
- Soft dark shadow
- `position: 'absolute'`, `left: 20`, `right: 20`, `bottom: insets.bottom + 12` (from `useSafeAreaInsets()`)
- Fixed height **64** (no `paddingBottom` inside)
- No text labels: `tabBarShowLabel: false`
- `tabItem` must have `alignItems: 'center'`, `justifyContent: 'center'`, `height: '100%'` — otherwise icons float to the top of the bar
- Active icon wrapped in a 44×44 yellow circle (`borderRadius: 999`, `backgroundColor: '#F6EB4C'`). Implement it as a small wrapper `<View>` rendered only when `focused === true`
- Active icon color: dark (`#111111`). Inactive icon color: also dark (because the bar is white) — no yellow tint on inactive

Center ride button (the `tabBarButton` for `draft-action`):
- 56×56 circle
- `backgroundColor: '#F6EB4C'`
- 4px white border (`borderColor: '#FFFFFF'`)
- Soft yellow shadow
- **Sits at the same vertical center as the other icons** — no negative `top` offset, does NOT poke above the bar. The white border is what visually separates it from the white pill behind it

### Step 4. Replace Solar Icons in the rest of the app

Find every Solar import:

```bash
grep -r "@solar-icons" app components --include="*.tsx" --include="*.ts"
```

Migrate the high-visibility ones (large icons, icons on accent backgrounds, icons inside buttons/badges/chips) to Lucide. Use this mapping:

| Solar                    | Lucide          |
| ------------------------ | --------------- |
| `Bolt`                   | `Zap`           |
| `Pulse2`                 | `Activity`      |
| `Map`                    | `Map`           |
| `MapPoint`               | `MapPin`        |
| `Compass`                | `Compass`       |
| `UsersGroupTwoRounded`   | `Users`         |
| `UsersGroupRounded`      | `Users`         |
| `User`                   | `User`          |
| `ArrowLeft`              | `ArrowLeft`     |
| `ArrowRight`             | `ArrowRight`    |
| `AltArrowRight`          | `ChevronRight`  |
| `CloseCircle`            | `XCircle`       |
| `Magnifier`              | `Search`        |
| `Camera`                 | `Camera`        |
| `InfoCircle`             | `Info`          |
| `DangerCircle`           | `AlertCircle`   |
| `Wind`                   | `Wind`          |
| `Tuning`                 | `Settings2`     |
| `Bicycling`              | `Bike`          |
| `Routing2`               | `Route`         |
| `TransferVertical`       | `ArrowUpDown`   |
| `Gps`                    | `LocateFixed`   |
| `MapArrowRight`          | `Navigation`    |
| `AddCircle`              | `PlusCircle`    |

For regular inline icons (in form fields, list rows, badges, info tags) keep Lucide as the default stroke style (`strokeWidth={2}`) — that's a clean outline with no gaps. Use the filled style (`fill={color} strokeWidth={0}`) ONLY for tab bar icons and other places where a strong filled silhouette is the design intent.

### Step 5. Verify

```bash
npx tsc --noEmit
npx expo lint
```

Both must pass without errors.

Run Expo (`npx expo start`) and visually verify:
1. Tab bar — white pill, active icon inside a yellow circle, every icon **has no visible lines inside** — fully solid silhouettes
2. Center ride button sits in the center of the bar with a white border and does not poke above the bar
3. Icons are evenly spaced and vertically centered
4. Hero card on Home is yellow, all other cards are dark

## Do NOT touch

- The color palette (`theme/colors.ts`) — it's correct
- Spacing / radius / typography tokens
- `lib/maps/api.ts`, `lib/routes.ts` — these modules are fine
- The overall Expo Router structure

## Why the Bold Solar variant didn't fix this before

The Bold variant for `Pulse2`, `Map`, `UsersGroupTwoRounded` is composed of 2–6 separate filled `<Path>` elements (verified by reading the SVG sources in `node_modules/@solar-icons/react-native/dist/icons/.../Bold/*.mjs`). There is always a hairline gap between paths even when they visually touch. SVG renders those gaps as thin lines — particularly noticeable on the yellow active background. Lucide icons use a single merged-geometry path, so they don't have this problem.

## Acceptance criteria

- [ ] Tab bar icons have zero visible inner lines / strokes / outlines
- [ ] Active tab icon is wrapped in a yellow circle
- [ ] Center ride button does not extend above the tab bar
- [ ] All icons are vertically centered in the bar
- [ ] No Solar icon import remains in `app/(tabs)/_layout.tsx`
- [ ] `npx tsc --noEmit` passes
- [ ] `npx expo lint` reports no new errors
