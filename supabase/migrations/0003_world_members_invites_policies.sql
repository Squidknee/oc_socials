-- Fixes a gap in 0001_init.sql: world_members and world_invites had RLS
-- enabled with only SELECT policies. With no INSERT policy, Postgres
-- denies all inserts by default — which silently broke "create a world"
-- (can't add yourself as owner-member, can't generate an invite code).

-- Allow a user to add themself to world_members, but only as "owner" and
-- only for a world they actually own. This covers world creation.
-- Joining via invite code will need its own policy/function later, since
-- that's a different user adding themself as "member" to someone else's
-- world — a case this policy deliberately does not cover yet.
create policy "world_members_insert_self_as_owner" on public.world_members
  for insert with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (select 1 from public.worlds w where w.id = world_members.world_id and w.owner_id = auth.uid())
  );

-- Allow world owners/mods to generate invite codes for their own world.
create policy "world_invites_select_member" on public.world_invites for select using (
  exists (select 1 from public.world_members m where m.world_id = world_invites.world_id and m.user_id = auth.uid())
);

create policy "world_invites_insert_owner_or_mod" on public.world_invites
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.world_members m
      where m.world_id = world_invites.world_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'mod')
    )
  );
