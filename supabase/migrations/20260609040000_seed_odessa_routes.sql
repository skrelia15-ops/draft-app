-- Reseed the route catalog with Odessa-named routes for launch.
-- Replaces the three generic placeholder rows. Geometry is generated
-- client-side (anchored to GPS, falling back to Odessa), so no coordinates
-- are stored here. group_rides.route_id is ON DELETE SET NULL, so removing
-- the old rows is safe. Idempotent via ON CONFLICT.

delete from public.routes where id in ('coastal', 'urban', 'mountain');

insert into public.routes
  (id, name, distance_km, difficulty, shape, pace_kmh, riders, draft_percent, traffic, note)
values
  ('arcadia-coastal',    'ARCADIA COASTAL SLIPSTREAM', 24.5, 'MODERATE', 'point-to-point', 32,  8, 92, 'MODERATE', 'Best drafting right now'),
  ('french-blvd',        'FRENCH BOULEVARD LOOP',      12.2, 'EASY',     'loop',           28, 15, 88, 'CLEAR',    null),
  ('vel-fontan',         'VELYKYI FONTAN OUT & BACK',  35.0, 'HARD',     'out-and-back',   24,  4, 78, 'CLEAR',    null),
  ('otrada-seaside',     'OTRADA SEASIDE CRUISE',       9.0, 'EASY',     'loop',           26, 11, 84, 'CLEAR',    null),
  ('lanzheron-sprint',   'LANZHERON SPRINT',           18.0, 'MODERATE', 'point-to-point', 31,  6, 86, 'MODERATE', null),
  ('derybasivska-draft', 'DERYBASIVSKA URBAN DRAFT',   14.0, 'EASY',     'loop',           27,  9, 83, 'CLEAR',    null)
on conflict (id) do update set
  name          = excluded.name,
  distance_km   = excluded.distance_km,
  difficulty    = excluded.difficulty,
  shape         = excluded.shape,
  pace_kmh      = excluded.pace_kmh,
  riders        = excluded.riders,
  draft_percent = excluded.draft_percent,
  traffic       = excluded.traffic,
  note          = excluded.note;
