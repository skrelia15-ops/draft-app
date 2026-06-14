# Weather Integration — Design Spec

Date: 2026-06-14
Branch: `feature/supabase-backend-auth`
Status: Approved design, pending implementation plan

## Goal

Replace the synthetic weather/conditions source (`lib/ride/conditions.ts`,
`getCurrentConditions()`) with **real weather** for the user's location,
fetched from OpenWeather through a Supabase Edge Function. Production
quality: API key server-side, caching, graceful fallback, no empty card.

The home hero card and route-details currently show wind + a derived
"draft index". Those keep working; only the *source* of wind becomes
real, and we add temperature and current-precipitation.

## Scope

In scope:
- Supabase Edge Function `weather` that proxies OpenWeather (free
  **Current Weather 2.5** endpoint) and caches results.
- Client `lib/weather/` package: provider + hook + types.
- Refactor draft-index derivation into a pure function fed by real wind.
- UI: home hero card gains temperature + precipitation; route-details
  wind becomes real.
- Fallback chain so the card is never empty.

Out of scope (separate sub-projects, already discussed):
- Apple Health / Google Health Connect integration.
- Real rider presence sharing + privacy toggle.
- Precipitation **probability** (% chance) — requires paid One Call 3.0;
  free tier only reports current precipitation.

## Data source

OpenWeather **Current Weather Data 2.5** (free, no card required).
Relevant response fields:
- `wind.speed` (m/s), `wind.deg` (degrees) → wind speed + direction
- `main.temp`, `main.feels_like` (°C, request `units=metric`)
- `weather[0].main` / `weather[0].id` → Rain / Snow / Clear …
- `rain["1h"]` (mm, present only when raining) → current precipitation

No precipitation probability on this tier (documented limitation).

## Architecture & data flow

```
useUserLocation (coords)
        │  (fallback: last-known coords from AsyncStorage → Odessa default)
        ▼
   useWeather()  ──invoke──►  Edge Function 'weather' { lat, lng }
        ▲                            │
        │                            ├─ read weather_cache (≤15 min)? → return
   last good (mem + AsyncStorage)    └─ miss → OpenWeather 2.5 → write cache → return
```

### Edge Function: `supabase/functions/weather/`
- Input: `{ lat: number, lng: number }` (via `supabase.functions.invoke`).
- Reads `OPENWEATHER_API_KEY` from function secrets (`supabase secrets set`).
- Coordinate cache key: lat/lng rounded to 2 decimals (~1.1 km cell).
- Cache lookup in table `weather_cache`; if `fetched_at` is within 15 min,
  return the cached row without calling OpenWeather.
- On miss: call OpenWeather `…/data/2.5/weather?lat&lon&units=metric`,
  normalize, upsert into `weather_cache`, return normalized JSON.
- On OpenWeather error: if a stale cache row exists, return it with a
  `stale: true` flag; else return HTTP error so the client can fall back.

Normalized response shape (the wire contract):
```ts
type WeatherDTO = {
  windKmh: number;        // wind.speed m/s → km/h (×3.6, rounded)
  windDeg: number;        // wind.deg
  windFrom: CompassDirection; // derived from windDeg (8-point)
  tempC: number;          // round(main.temp)
  feelsLikeC: number;     // round(main.feels_like)
  isRaining: boolean;     // weather[0].main in {Rain, Drizzle, Thunderstorm, Snow}
  rainMmLastHour: number; // rain["1h"] ?? 0
  observedAt: number;     // epoch ms when fetched from OpenWeather
};
```

### Migration: `weather_cache` table
```
weather_cache(
  cell_key text primary key,   -- "lat2,lng2" rounded
  payload  jsonb not null,     -- WeatherDTO
  fetched_at timestamptz not null default now()
)
```
RLS: no direct client access — only the Edge Function (service role)
reads/writes. Client never touches the table directly.

### Client: `lib/weather/`
- `types.ts` — `Weather` (same fields as `WeatherDTO`) + re-export
  `CompassDirection`.
- `api.ts` — `fetchWeather(coords): Promise<Weather>` wrapping
  `supabase.functions.invoke('weather', { body: { lat, lng } })`.
- `WeatherProvider.tsx` + `useWeather()`:
  - Resolves coordinates: live GPS (`useUserLocation`) → last-known
    (persisted in AsyncStorage on every successful fix) → `ODESSA`.
  - Fetches on mount and when the resolved cell changes; refreshes every
    15 min while mounted.
  - Holds last successful `Weather` in state + AsyncStorage; on fetch
    failure keeps showing the last good value.
  - Exposes `{ weather, isStale, observedAt, refresh }`.
- `index.ts` — barrel exports. Provider mounted in `app/_layout.tsx`
  alongside the other providers.

### Bridge to draft logic
- Rename/refactor `getCurrentConditions()` → pure
  `deriveConditions(weather: Weather): Conditions` in `lib/ride/conditions.ts`.
  It keeps the existing wind→draftIndex/draftLabel/draftAdvice thresholds
  but reads `weather.windKmh` / `weather.windFrom` instead of the clock,
  and passes through `tempC`, `feelsLikeC`, `isRaining`, `rainMmLastHour`.
- `Conditions` type gains: `tempC`, `feelsLikeC`, `isRaining`, `rainMmLastHour`.
- **proximity.ts:** `getNearbyRiders` currently calls
  `getCurrentConditions()` internally (sync). Change it to accept the
  derived `Conditions` (or just `draftLabel`) as a parameter so it no
  longer reaches into the conditions module. Home already computes both
  riders and conditions; it will pass conditions in.

### Screen wiring
- `app/(tabs)/index.tsx`: replace `getCurrentConditions()` with
  `useWeather()` → `deriveConditions(weather)`. Pass conditions into
  `getNearbyRiders`. Add temp + precip to the hero card; add a small
  "updated N min ago" caption (from `observedAt`).
- `app/ride/route-details.tsx`: same swap; wind row becomes real.
  Optionally surface temperature.

## UI changes

Home hero card (`app/(tabs)/index.tsx`):
- Existing WIND stat stays (now real).
- Add temperature near the condition pill or as an extra stat:
  `tempC°` with feels-like.
- Precipitation indicator: "Rain · 1.2 mm" when `isRaining`, else "Dry".
- Caption: "updated Nm ago" derived from `observedAt`.

route-details: wind row real; temperature optional addition.

## Fallback / error behavior

Coordinate resolution (first available wins):
1. Live GPS fix.
2. Last-known coords persisted in AsyncStorage.
3. `ODESSA` constant (app's default region).

Weather fetch failure:
- Return last good `Weather` from memory/AsyncStorage if present.
- Else the Edge Function's stale-cache fallback.
- Else conditions derived from a neutral default so the card still renders.

The hero card is never blank.

## Configuration / secrets

- `OPENWEATHER_API_KEY` set via `supabase secrets set OPENWEATHER_API_KEY=…`
  — never in the app bundle or committed.
- No new client-side env vars (the function URL comes from the existing
  Supabase client config).

## Testing

- **Unit (pure functions):**
  - `deriveConditions`: table of (windKmh, windFrom, temp, rain) →
    expected draftIndex/draftLabel/draftAdvice + passthrough fields,
    covering each wind bucket boundary (8/14/20 km/h).
  - Coordinate-resolution helper: GPS → last-known → Odessa precedence.
  - `windFrom` from `windDeg` mapping (8-point compass boundaries).
- **Edge Function smoke test:** local `supabase functions serve` invoke
  with a stub/fixture; assert normalization + cache hit path.
- RN UI is not unit-tested; all real logic lives in pure functions that
  are.

## Risks / notes

- OpenWeather 2.5 has no precipitation probability — product accepts
  "is it raining now" instead (decided).
- 15-min server cache + ~1 km cell key keeps API usage low and within the
  free tier even with many users near each other.
- Making conditions async means any code path that assumed synchronous
  `getCurrentConditions()` must move to the hook or accept conditions as a
  parameter (notably `getNearbyRiders`).
