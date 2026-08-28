-- Allows a world's owner to edit its name/description. Same shape as
-- 0006's delete policy — no one else (not even mods) can.

create policy "worlds_update_owner" on public.worlds for update using (
  owner_id = auth.uid()
);
