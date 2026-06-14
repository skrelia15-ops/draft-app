-- Server-side weather cache. Written/read only by the `weather` Edge
-- Function via the service role; no direct client access.

create table if not exists public.weather_cache (
  cell_key   text primary key,            -- "lat2,lng2" rounded to ~1km
  payload    jsonb not null,              -- normalized WeatherDTO
  fetched_at timestamptz not null default now()
);

alter table public.weather_cache enable row level security;
-- No policies: anon/authenticated get no access. The Edge Function uses
-- the service-role key, which bypasses RLS.
