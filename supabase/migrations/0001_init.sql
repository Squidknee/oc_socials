-- OC Social — initial schema
-- Mirrors /app-design-doc.md

create extension if not exists "pgcrypto";

-- USERS
-- Supabase Auth already provides auth.users; we keep a public profile table
-- keyed to it so we can add app-specific fields without touching auth schema.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

-- WORLDS
create table public.worlds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.users(id) on delete cascade,
  visibility text not null default 'invite_only' check (visibility in ('invite_only')),
  created_at timestamptz not null default now()
);

-- WORLD MEMBERS
create table public.world_members (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'mod', 'member')),
  joined_at timestamptz not null default now(),
  unique (world_id, user_id)
);

-- WORLD INVITES
create table public.world_invites (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  code text unique not null default encode(gen_random_bytes(6), 'hex'),
  created_by uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz,
  max_uses int,
  uses int not null default 0,
  created_at timestamptz not null default now()
);

-- CHARACTERS
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  handle text not null,
  display_name text not null,
  avatar_url text,
  bio text,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (world_id, handle)
);

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  content text not null,
  media_url text,
  created_at timestamptz not null default now()
);

-- COMMENTS
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- LIKES
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, character_id)
);

-- Helpful indexes for feed queries
create index idx_posts_world_created on public.posts (world_id, created_at desc);
create index idx_characters_owner on public.characters (owner_id);
create index idx_world_members_user on public.world_members (user_id);

-- ─────────────────────────────────────────────
-- Row Level Security
-- All worlds are invite-only, so access to a world's data is gated on
-- membership in world_members. Enable RLS and add baseline policies;
-- tighten/expand these as features (mod tools, etc.) get built.
-- ─────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.worlds enable row level security;
alter table public.world_members enable row level security;
alter table public.world_invites enable row level security;
alter table public.characters enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

-- users: anyone authenticated can read basic profiles; only the user can edit their own
create policy "users_select_all" on public.users for select using (auth.role() = 'authenticated');
create policy "users_update_self" on public.users for update using (auth.uid() = id);

-- worlds: visible only to members
create policy "worlds_select_member" on public.worlds for select using (
  exists (select 1 from public.world_members m where m.world_id = worlds.id and m.user_id = auth.uid())
);
create policy "worlds_insert_owner" on public.worlds for insert with check (owner_id = auth.uid());

-- world_members: visible to other members of the same world
create policy "world_members_select_member" on public.world_members for select using (
  exists (select 1 from public.world_members m where m.world_id = world_members.world_id and m.user_id = auth.uid())
);

-- characters: visible only within worlds the user belongs to
create policy "characters_select_member" on public.characters for select using (
  exists (select 1 from public.world_members m where m.world_id = characters.world_id and m.user_id = auth.uid())
);
create policy "characters_insert_member" on public.characters for insert with check (
  owner_id = auth.uid()
  and exists (select 1 from public.world_members m where m.world_id = characters.world_id and m.user_id = auth.uid())
);
create policy "characters_update_owner" on public.characters for update using (owner_id = auth.uid());
create policy "characters_delete_owner" on public.characters for delete using (owner_id = auth.uid());

-- posts: visible/postable only within worlds the user belongs to, as one of their own characters
create policy "posts_select_member" on public.posts for select using (
  exists (select 1 from public.world_members m where m.world_id = posts.world_id and m.user_id = auth.uid())
);
create policy "posts_insert_own_character" on public.posts for insert with check (
  exists (select 1 from public.characters c where c.id = posts.character_id and c.owner_id = auth.uid() and c.world_id = posts.world_id)
);

-- comments: same shape as posts, scoped via the parent post's world
create policy "comments_select_member" on public.comments for select using (
  exists (
    select 1 from public.posts p
    join public.world_members m on m.world_id = p.world_id
    where p.id = comments.post_id and m.user_id = auth.uid()
  )
);
create policy "comments_insert_own_character" on public.comments for insert with check (
  exists (select 1 from public.characters c where c.id = comments.character_id and c.owner_id = auth.uid())
);

-- likes: same pattern
create policy "likes_select_member" on public.likes for select using (
  exists (
    select 1 from public.posts p
    join public.world_members m on m.world_id = p.world_id
    where p.id = likes.post_id and m.user_id = auth.uid()
  )
);
create policy "likes_insert_own_character" on public.likes for insert with check (
  exists (select 1 from public.characters c where c.id = likes.character_id and c.owner_id = auth.uid())
);
