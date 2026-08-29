-- Live "Shared Characters": WorldFeed just re-derives its character
-- lists wholesale on any change (see its own comment) rather than
-- patching a row in place, so default replica identity (primary key
-- only) is enough here — no need for FULL like likes (0017) got.
alter publication supabase_realtime add table public.characters;
