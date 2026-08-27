-- Fixes "infinite recursion detected in policy for relation world_members".
-- The original world_members_select_member policy queried world_members
-- from inside its own USING clause to check membership — which re-triggers
-- the same policy, forever.
--
-- Fix: a SECURITY DEFINER function runs with the privileges of the user
-- who defined it (not the querying user), which means it bypasses RLS
-- internally. That lets us check "is this user a member of this world?"
-- without recursively invoking the policy we're trying to enforce.

create or replace function public.is_world_member(_world_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.world_members
    where world_id = _world_id and user_id = _user_id
  );
$$;

drop policy if exists "world_members_select_member" on public.world_members;

create policy "world_members_select_member" on public.world_members for select using (
  public.is_world_member(world_id, auth.uid())
);
