-- Live feed updates: same postgres_changes + existing-SELECT-policy
-- pattern 0016 used for messages (posts_select_member/likes_select_member/
-- comments_select_member from 0001 do the filtering, unchanged).
--
-- likes gets REPLICA IDENTITY FULL because a DELETE's payload only
-- carries primary-key columns by default — we need platform_account_id
-- on the old row too, to remove the right entry from a viewer's local
-- like list when someone else unlikes a post they're looking at.
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.likes;
alter publication supabase_realtime add table public.comments;
alter table public.likes replica identity full;
