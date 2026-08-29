-- likes has had RLS enabled since 0001 with a SELECT and an INSERT
-- policy, but no DELETE policy was ever added — meaning unliking
-- (usePostInteractions.js's toggleLike delete branch) has been silently
-- denied by RLS's default-deny this whole time.
--
-- Uses can_act_as_character (0029) rather than a bare owner_id check so
-- unliking stays consistent with liking: anyone who can like as a
-- character (owner, or anyone for a public/shared one) can also unlike
-- as it, not just whichever of them happened to be the original owner.
create policy "likes_delete_can_act_as" on public.likes for delete using (
  exists (
    select 1 from public.platform_accounts pa
    where pa.id = likes.platform_account_id and public.can_act_as_character(pa.character_id, auth.uid())
  )
);
