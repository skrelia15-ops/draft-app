-- Groups, membership, scheduled rides, member-count view, owner-membership trigger, RLS.

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  pace_kmh    integer not null,
  train_type  text not null check (train_type in ('ROTATING','STEADY','TEMPO')),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.group_rides (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  title        text not null,
  scheduled_at timestamptz not null,
  route_id     text references public.routes(id) on delete set null,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- Member-count view (derives the UI "riders" figure). security_invoker is set
-- in the hardening migration so it respects the querying user's RLS.
create view public.groups_with_counts as
  select g.*, count(m.user_id)::int as member_count
  from public.groups g
  left join public.group_members m on m.group_id = g.id
  group by g.id;

-- Add the owner as a member automatically on group creation. SECURITY DEFINER
-- so it can write the owner row past the "join self / role=member" RLS.
create function public.handle_group_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_group_created();

-- Membership check used by group_rides RLS.
create function public.is_group_member(gid uuid)
returns boolean language sql security invoker set search_path = '' stable as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_rides enable row level security;

create policy "groups readable by authenticated"
  on public.groups for select to authenticated using (true);
create policy "groups insertable by owner"
  on public.groups for insert to authenticated with check (owner_id = auth.uid());
create policy "groups updatable by owner"
  on public.groups for update to authenticated using (owner_id = auth.uid());
create policy "groups deletable by owner"
  on public.groups for delete to authenticated using (owner_id = auth.uid());

create policy "members readable by authenticated"
  on public.group_members for select to authenticated using (true);
create policy "join self"
  on public.group_members for insert to authenticated
  with check (user_id = auth.uid() and role = 'member');
create policy "leave self or owner removes"
  on public.group_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create policy "rides readable by authenticated"
  on public.group_rides for select to authenticated using (true);
create policy "rides insertable by members"
  on public.group_rides for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_member(group_id));
create policy "rides updatable by creator"
  on public.group_rides for update to authenticated using (created_by = auth.uid());
create policy "rides deletable by creator or owner"
  on public.group_rides for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
