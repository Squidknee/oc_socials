-- Per-world counts for the World selector cards and hub header.
--
-- security_invoker = true is load-bearing, not optional: without it, a
-- view runs with its OWNER's privileges (the migration role), which
-- bypasses every RLS policy on the tables it reads — every world's real
-- counts would leak to every user regardless of membership. With it set,
-- these subqueries run under the querying user's own row-level security,
-- same as querying characters/world_members/posts directly.
create view public.world_stats
with (security_invoker = true)
as
select
  w.id as world_id,
  (select count(*) from public.characters c where c.world_id = w.id) as character_count,
  (select count(*) from public.world_members m where m.world_id = w.id) as member_count,
  (select count(*) from public.posts p where p.world_id = w.id) as post_count
from public.worlds w;
