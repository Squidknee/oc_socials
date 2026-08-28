-- Lets a post be deleted by whoever authored it. Same ownership shape as
-- posts_update_own_platform_account (0023). comments/likes/post_media all
-- already cascade-delete from posts (0001/0008), so no extra cleanup is
-- needed here.
create policy "posts_delete_own_platform_account" on public.posts for delete using (
  exists (
    select 1 from public.platform_accounts pa
    join public.characters c on c.id = pa.character_id
    where pa.id = posts.platform_account_id and c.owner_id = auth.uid()
  )
);
