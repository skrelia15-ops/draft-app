-- Allow a signed-in user to permanently delete their own account.
--
-- A client (with the anon/publishable key) cannot delete an auth user, so we
-- expose a SECURITY DEFINER function that runs with the owner's privileges.
-- It only ever deletes auth.uid() — the caller — so a user can never delete
-- anyone else. The app's profile screen calls this via `supabase.rpc`.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- App data first (in case these tables don't cascade from auth.users),
  -- then the auth user itself (which cascades groups / group_members /
  -- group_rides / routes that reference auth.users on delete cascade).
  delete from public.rides    where user_id = auth.uid();
  delete from public.profiles where id = auth.uid();
  delete from auth.users      where id = auth.uid();
end;
$$;

revoke all on function public.delete_account() from anon, public;
grant execute on function public.delete_account() to authenticated;
