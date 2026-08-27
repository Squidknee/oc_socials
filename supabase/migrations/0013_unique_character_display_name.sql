-- Handles were already unique per world (0001); display names weren't —
-- two characters could both be "Rusty Knight" in the same world with
-- different handles. Closing that gap the same way.
alter table public.characters
  add constraint characters_world_id_display_name_key unique (world_id, display_name);
