-- Explore route catalog (admin/seed-managed, read-only from the client).
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
  on public.routes for select to authenticated using (true);

insert into public.routes (id, name, distance_km, difficulty, shape, pace_kmh, riders, draft_percent, traffic, note) values
  ('coastal',  'COASTAL SLIPSTREAM', 24.5, 'MODERATE', 'point-to-point', 32,  8, 92, 'MODERATE', 'Best drafting right now'),
  ('urban',    'URBAN DRAFT LOOP',   12.2, 'EASY',     'loop',           28, 15, 88, 'CLEAR',    null),
  ('mountain', 'MOUNTAIN PASS',      35.0, 'HARD',     'out-and-back',   24,  4, 78, 'CLEAR',    null);
