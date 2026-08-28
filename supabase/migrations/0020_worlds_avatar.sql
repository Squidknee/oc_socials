-- A world's own avatar/logo, same shape as characters.avatar_url and
-- platform_accounts.avatar_url — optional, falls back to a monogram tile
-- in the UI when unset. Covered by the existing worlds RLS policies
-- (select/insert/update), no new policy needed for one more column.
alter table public.worlds add column avatar_url text;
