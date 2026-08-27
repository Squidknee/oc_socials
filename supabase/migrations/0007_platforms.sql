-- Introduces multi-platform social accounts, built around a shared post
-- shape + per-platform config, rather than hardcoded per-platform logic.
--
--   platforms         - the fixed set of "sites" (Instagram, Twitter,
--                        iMessage), PLUS a config row of feature flags
--                        for each one (requires_media, max_caption_length,
--                        supports_likes, etc). The UI reads these flags to
--                        decide which fields/buttons to show — a shared
--                        "post composer" component turns features on/off
--                        based on this config instead of duplicating a
--                        composer per platform.
--   platform_accounts - a character's account on ONE specific platform.
--                        Seeded from the character's master profile at
--                        creation time, then independently editable —
--                        no ongoing sync back to the character.
--
-- posts/comments/likes belong to a platform_account instead of a bare
-- character, since content is authored by a specific platform persona.
-- No real posts/comments/likes exist yet (no composer UI existed before
-- this migration), so these are destructive column swaps, not a careful
-- data migration.
--
-- Platform ids are fixed literal UUIDs (not gen_random_uuid()) so app
-- code can reference a specific platform without a lookup query.

create table public.platforms (
  id uuid primary key,
  slug text unique not null,
  name text not null,
  -- 'feed' = public posts (Instagram, Twitter); 'messaging' = private
  -- conversations (iMessage) — not built yet, but fixed now so this
  -- table doesn't need another migration to add it later.
  kind text not null check (kind in ('feed', 'messaging')),

  -- Feature flags: the "skin" config the composer/feed UI reads to know
  -- which shared fields and interactions to expose for this platform.
  requires_media boolean not null default false,
  allows_media boolean not null default true,
  max_caption_length int,          -- null = unlimited
  supports_likes boolean not null default true,
  supports_comments boolean not null default true,
  supports_reblogs boolean not null default false,
  supports_location boolean not null default false
);

insert into public.platforms
  (id, slug, name, kind, requires_media, allows_media, max_caption_length, supports_likes, supports_comments, supports_reblogs, supports_location)
values
  ('10000000-0000-0000-0000-000000000001', 'instagram', 'Instagram', 'feed', true,  true,  2200, true, true, false, true),
  ('10000000-0000-0000-0000-000000000002', 'twitter',   'Twitter',   'feed', false, true,  280,  true, true, true,  false),
  ('10000000-0000-0000-0000-000000000003', 'imessage',  'iMessage',  'messaging', false, false, null, false, false, false, false);

create table public.platform_accounts (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  platform_id uuid not null references public.platforms(id) on delete cascade,
  -- Denormalized from characters.world_id (kept in sync by the app at
  -- insert time) so RLS/queries can filter by world without an extra
  -- join back through characters every time.
  world_id uuid not null references public.worlds(id) on delete cascade,
  handle text not null,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  unique (character_id, platform_id),
  unique (world_id, platform_id, handle)
);

create index idx_platform_accounts_character on public.platform_accounts (character_id);

-- POSTS: shared shape for every platform — caption, image, timestamp,
-- location — with platform_id deciding which fields actually get used.
-- (created_at already covers "timestamp"; content already covers
-- "caption"; media_url already covers "image".)
alter table public.posts drop column character_id;
alter table public.posts add column platform_account_id uuid not null references public.platform_accounts(id) on delete cascade;
alter table public.posts add column platform_id uuid not null references public.platforms(id) on delete cascade;
alter table public.posts add column location text;

drop index if exists idx_posts_world_created;
create index idx_posts_world_platform_created on public.posts (world_id, platform_id, created_at desc);

-- Config-driven validation: a CHECK constraint can't reference another
-- table, so "does this platform require media?" has to be enforced with
-- a trigger that looks the flag up from platforms — not a hardcoded
-- per-platform CHECK. This is the actual database-side version of the
-- "skin" idea: one function, driven by whatever's in the platforms table,
-- rather than special-cased per platform.
create or replace function public.validate_post_against_platform()
returns trigger as $$
declare
  platform record;
begin
  select requires_media, max_caption_length into platform
  from public.platforms where id = new.platform_id;

  if platform.requires_media and new.media_url is null then
    raise exception 'This platform requires an image.';
  end if;

  if platform.max_caption_length is not null
     and new.content is not null
     and length(new.content) > platform.max_caption_length then
    raise exception 'Caption exceeds the % character limit for this platform.', platform.max_caption_length;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger validate_post_before_write
  before insert or update on public.posts
  for each row execute function public.validate_post_against_platform();

-- COMMENTS / LIKES: same author swap as posts.
alter table public.comments drop column character_id;
alter table public.comments add column platform_account_id uuid not null references public.platform_accounts(id) on delete cascade;

alter table public.likes drop column character_id;
alter table public.likes add column platform_account_id uuid not null references public.platform_accounts(id) on delete cascade;
alter table public.likes add constraint likes_post_id_platform_account_id_key unique (post_id, platform_account_id);

-- RLS ---------------------------------------------------------------

alter table public.platforms enable row level security;
alter table public.platform_accounts enable row level security;

-- Platforms are fixed reference/config data — every authenticated user
-- can read the list (and its feature flags); nothing in the app writes
-- to this table.
create policy "platforms_select_all" on public.platforms for select using (auth.role() = 'authenticated');

create policy "platform_accounts_select_member" on public.platform_accounts for select using (
  public.is_world_member(world_id, auth.uid())
);

create policy "platform_accounts_insert_own_character" on public.platform_accounts for insert with check (
  exists (
    select 1 from public.characters c
    where c.id = platform_accounts.character_id
      and c.owner_id = auth.uid()
      and c.world_id = platform_accounts.world_id
  )
);

create policy "platform_accounts_update_owner" on public.platform_accounts for update using (
  exists (select 1 from public.characters c where c.id = platform_accounts.character_id and c.owner_id = auth.uid())
);

create policy "platform_accounts_delete_owner" on public.platform_accounts for delete using (
  exists (select 1 from public.characters c where c.id = platform_accounts.character_id and c.owner_id = auth.uid())
);

-- posts/comments/likes SELECT policies didn't reference character_id, so
-- they keep working unchanged. INSERT policies need to check ownership
-- via platform_accounts -> characters instead of the old direct
-- character_id link.

drop policy if exists "posts_insert_own_character" on public.posts;
create policy "posts_insert_own_platform_account" on public.posts for insert with check (
  exists (
    select 1 from public.platform_accounts pa
    join public.characters c on c.id = pa.character_id
    where pa.id = posts.platform_account_id
      and c.owner_id = auth.uid()
      and pa.world_id = posts.world_id
      and pa.platform_id = posts.platform_id
  )
);

drop policy if exists "comments_insert_own_character" on public.comments;
create policy "comments_insert_own_platform_account" on public.comments for insert with check (
  exists (
    select 1 from public.platform_accounts pa
    join public.characters c on c.id = pa.character_id
    where pa.id = comments.platform_account_id and c.owner_id = auth.uid()
  )
);

drop policy if exists "likes_insert_own_character" on public.likes;
create policy "likes_insert_own_platform_account" on public.likes for insert with check (
  exists (
    select 1 from public.platform_accounts pa
    join public.characters c on c.id = pa.character_id
    where pa.id = likes.platform_account_id and c.owner_id = auth.uid()
  )
);
