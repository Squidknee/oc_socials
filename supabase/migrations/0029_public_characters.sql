-- Public/shared characters: a character anyone in the world can post as,
-- comment/like as, or edit the platform-account bios/avatars/handles of
-- — like a communal OC, instead of one person's alone.
--
-- Deliberately NOT a separate table/moving rows — characters is
-- referenced by platform_accounts, posts, comments, likes, and messages,
-- and physically relocating a row would mean rewriting every one of
-- those foreign keys instead of just widening who's allowed to act
-- through it. A flag + widened RLS is the same end result (posting as
-- it, editing it) with none of that churn, and is trivially reversible.
--
-- owner_id is unchanged and still the only one who can flip is_public
-- back off, delete the character, edit its own master profile, or
-- create/delete its platform accounts — sharing here only ever widens
-- posting/commenting/liking and platform-account persona edits, never
-- deletion or the structural stuff.

-- Purely a display preference for the world's "Shared Characters"
-- sidebar section — a character's own is_public flag (below) is what
-- actually grants anything, independent of this toggle.
alter table public.worlds add column public_characters_enabled boolean not null default false;

alter table public.characters add column is_public boolean not null default false;

-- Same shape as is_world_member/is_conversation_participant — security
-- definer so callers don't duplicate this join, and so a character's own
-- restrictive characters_select_member policy can't recurse into itself.
create or replace function public.can_act_as_character(_character_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.characters c
    where c.id = _character_id
      and (
        c.owner_id = _user_id
        or (c.is_public and public.is_world_member(c.world_id, _user_id))
      )
  );
$$;

-- posts/comments/likes: anyone who can act as the authoring character
-- can post as it, not just its owner.
drop policy "posts_insert_own_platform_account" on public.posts;
create policy "posts_insert_own_platform_account" on public.posts for insert with check (
  exists (
    select 1 from public.platform_accounts pa
    where pa.id = posts.platform_account_id
      and public.can_act_as_character(pa.character_id, auth.uid())
      and pa.world_id = posts.world_id
      and pa.platform_id = posts.platform_id
  )
);

drop policy "comments_insert_own_platform_account" on public.comments;
create policy "comments_insert_own_platform_account" on public.comments for insert with check (
  exists (
    select 1 from public.platform_accounts pa
    where pa.id = comments.platform_account_id and public.can_act_as_character(pa.character_id, auth.uid())
  )
);

drop policy "likes_insert_own_platform_account" on public.likes;
create policy "likes_insert_own_platform_account" on public.likes for insert with check (
  exists (
    select 1 from public.platform_accounts pa
    where pa.id = likes.platform_account_id and public.can_act_as_character(pa.character_id, auth.uid())
  )
);

-- platform_accounts: anyone who can act as the character can edit that
-- persona's bio/avatar/handle/display_name too. Creating a brand new
-- account or deleting one stays owner-only (platform_accounts_insert_own_
-- character / platform_accounts_delete_owner, both unchanged) — this
-- feature widens editing an existing persona, not structural changes.
drop policy "platform_accounts_update_owner" on public.platform_accounts;
create policy "platform_accounts_update_shared" on public.platform_accounts for update using (
  public.can_act_as_character(platform_accounts.character_id, auth.uid())
);
