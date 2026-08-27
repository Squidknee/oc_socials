-- Fixes "new row violates row-level security policy for table worlds" on
-- world creation. The real cause: CreateWorldForm does
-- insert(...).select().single(), and Postgrest tries to read the new row
-- back immediately. That read needs to pass worlds_select_member, which
-- required existing membership in world_members — but the owner's
-- membership row isn't inserted until the *next* step. Chicken-and-egg:
-- you can't see the world you just made because you're not "in" it yet.
--
-- Fix: owners can always see worlds they own, membership or not.

drop policy if exists "worlds_select_member" on public.worlds;

create policy "worlds_select_member" on public.worlds for select using (
  owner_id = auth.uid()
  or exists (select 1 from public.world_members m where m.world_id = worlds.id and m.user_id = auth.uid())
);
