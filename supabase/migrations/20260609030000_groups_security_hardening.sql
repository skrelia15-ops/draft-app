-- Address Supabase security advisors for the groups schema:
--  * groups_with_counts was a SECURITY DEFINER view (ERROR) -> respect caller RLS.
--  * is_group_member need not be SECURITY DEFINER (group_members is readable by
--    authenticated) -> make it INVOKER to clear the definer-executable warning.
--  * handle_group_created must stay SECURITY DEFINER, but should not be directly
--    callable -> revoke EXECUTE (the trigger still fires as table owner).

alter view public.groups_with_counts set (security_invoker = true);

create or replace function public.is_group_member(gid uuid)
returns boolean language sql security invoker set search_path = '' stable as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

revoke execute on function public.handle_group_created() from public, anon, authenticated;
