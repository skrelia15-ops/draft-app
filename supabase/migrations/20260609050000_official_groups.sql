-- Allow product-owned ("official") groups: ownerless, seeded for launch.

alter table public.groups alter column owner_id drop not null;
alter table public.groups add column if not exists is_official boolean not null default false;

-- Only add an owner membership row when there is an owner (official groups
-- have none). Replaces the original trigger function; keep it SECURITY DEFINER
-- and non-directly-callable (matches the hardening migration).
create or replace function public.handle_group_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null then
    insert into public.group_members (group_id, user_id, role)
    values (new.id, new.owner_id, 'owner');
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_group_created() from public, anon, authenticated;

-- Tighten insert: authenticated users may only create non-official groups they
-- own. Official groups are inserted by seed/migration (no JWT, RLS not enforced).
drop policy if exists "groups insertable by owner" on public.groups;
create policy "groups insertable by owner"
  on public.groups for insert to authenticated
  with check (owner_id = auth.uid() and is_official = false);

-- Recreate the member-count view so it picks up the new column, then re-apply
-- security_invoker (set originally in the hardening migration).
drop view if exists public.groups_with_counts;
create view public.groups_with_counts as
  select g.*, count(m.user_id)::int as member_count
  from public.groups g
  left join public.group_members m on m.group_id = g.id
  group by g.id;
alter view public.groups_with_counts set (security_invoker = true);

-- Seed the launch official groups (ownerless).
insert into public.groups (name, description, pace_kmh, train_type, owner_id, is_official)
values
  ('ARCADIA RIDERS',          'Easy coastal cruises around Arcadia.',                28, 'STEADY',   null, true),
  ('FRENCH BOULEVARD TEMPO',  'Tempo efforts down the boulevard, no drop.',          30, 'TEMPO',    null, true),
  ('VELYKYI FONTAN ROTATION', 'Rotating pacelines on the long southern roads.',      33, 'ROTATING', null, true),
  ('PORT DAWN PATROL',        'Early starts, fast rotations before the city wakes.', 32, 'ROTATING', null, true);
