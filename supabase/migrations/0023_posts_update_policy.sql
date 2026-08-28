-- Lets a post be edited after publishing. There was no UPDATE policy on
-- posts at all before this. Same ownership shape as
-- posts_insert_own_platform_account (0008) — only the platform account
-- that authored it (i.e. its owning character) can edit it.
--
-- validate_post_against_platform (0008) already runs "before insert or
-- update", so requires_media/max_caption_length enforcement applies to
-- edits automatically — no trigger changes needed.
create policy "posts_update_own_platform_account" on public.posts for update using (
  exists (
    select 1 from public.platform_accounts pa
    join public.characters c on c.id = pa.character_id
    where pa.id = posts.platform_account_id and c.owner_id = auth.uid()
  )
);

-- An edit replaces post_media wholesale (delete then re-insert) rather
-- than trying to diff/reorder existing rows — simplest correct semantics
-- for a carousel that can also change length. Needs a DELETE policy,
-- which didn't exist before either.
create policy "post_media_delete_own_platform_account" on public.post_media for delete using (
  exists (
    select 1 from public.posts p
    join public.platform_accounts pa on pa.id = p.platform_account_id
    join public.characters c on c.id = pa.character_id
    where p.id = post_media.post_id and c.owner_id = auth.uid()
  )
);
