-- Lets a comment be deleted by whoever authored it. Same ownership shape
-- as posts_delete_own_platform_account (0024) / likes.
create policy "comments_delete_own_platform_account" on public.comments for delete using (
  exists (
    select 1 from public.platform_accounts pa
    join public.characters c on c.id = pa.character_id
    where pa.id = comments.platform_account_id and c.owner_id = auth.uid()
  )
);
