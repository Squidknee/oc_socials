-- Allows a world's owner to delete it. No one else (not even mods) can.
-- Everything hanging off a world — world_members, characters, posts,
-- comments, likes, world_invites — already has "on delete cascade" back
-- to worlds (see 0001_init.sql), so deleting a world cleans up everything
-- inside it automatically; no extra cleanup queries needed.

create policy "worlds_delete_owner" on public.worlds for delete using (
  owner_id = auth.uid()
);
