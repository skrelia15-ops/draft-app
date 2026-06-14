-- Optional Apple Health metrics attached to a ride after it finishes.
alter table public.rides add column if not exists avg_heart_rate int;
alter table public.rides add column if not exists max_heart_rate int;
alter table public.rides add column if not exists active_calories numeric;
