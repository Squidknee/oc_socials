-- Extends posts for the first real platform "skin" (Instagram): fabricated
-- like counts that still move with real interactions, multi-photo/video
-- carousels, and a real follows graph so "liked by someone you follow" is
-- genuine instead of made up.

-- LIKES: the composer sets a baseline they want the post to start at; the
-- number actually shown is that baseline PLUS every real `likes` row, so a
-- friend's real like still moves the number instead of silently
-- overriding it. Displayed count is computed in the app (base_like_count +
-- count(likes)), not stored redundantly.
alter table public.posts add column base_like_count int not null default 0;

-- MEDIA: posts.media_url stays the required "cover" item — unchanged, so
-- validate_post_against_platform's requires_media check keeps working
-- exactly as it does today. post_media holds any additional carousel
-- items beyond the cover. media_kind distinguishes photo vs video for the
-- cover; each post_media row carries its own kind.
alter table public.posts add column media_kind text check (media_kind in ('image', 'video'));

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  media_url text not null,
  kind text not null check (kind in ('image', 'video')),
  position int not null default 0
);
create index idx_post_media_post on public.post_media (post_id, position);

alter table public.post_media enable row level security;

create policy "post_media_select_member" on public.post_media for select using (
  exists (
    select 1 from public.posts p
    join public.world_members m on m.world_id = p.world_id
    where p.id = post_media.post_id and m.user_id = auth.uid()
  )
);

create policy "post_media_insert_own_platform_account" on public.post_media for insert with check (
  exists (
    select 1 from public.posts p
    join public.platform_accounts pa on pa.id = p.platform_account_id
    join public.characters c on c.id = pa.character_id
    where p.id = post_media.post_id and c.owner_id = auth.uid()
  )
);

-- FOLLOWS: per platform_account, not per character — a character's
-- Instagram and Twitter presences are independent personas (the whole
-- point of 0007), so who follows whom is independent per platform too.
-- world_id is denormalized the same way platform_accounts.world_id is —
-- kept in sync by the app, not enforced by a constraint here.
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  follower_account_id uuid not null references public.platform_accounts(id) on delete cascade,
  followed_account_id uuid not null references public.platform_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_account_id, followed_account_id),
  check (follower_account_id <> followed_account_id)
);
create index idx_follows_follower on public.follows (follower_account_id);
create index idx_follows_followed on public.follows (followed_account_id);

alter table public.follows enable row level security;

create policy "follows_select_member" on public.follows for select using (
  public.is_world_member(world_id, auth.uid())
);

create policy "follows_insert_own_account" on public.follows for insert with check (
  exists (
    select 1 from public.platform_accounts pa
    join public.characters c on c.id = pa.character_id
    where pa.id = follows.follower_account_id and c.owner_id = auth.uid()
  )
);

create policy "follows_delete_own_account" on public.follows for delete using (
  exists (
    select 1 from public.platform_accounts pa
    join public.characters c on c.id = pa.character_id
    where pa.id = follows.follower_account_id and c.owner_id = auth.uid()
  )
);
