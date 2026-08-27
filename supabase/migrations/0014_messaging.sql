-- Messaging core: shared by any "messaging"-kind platform (iMessage now,
-- Discord DMs later) the same way posts/comments/likes are shared by
-- every "feed"-kind platform. Participants are characters directly, not
-- platform_accounts — messaging has no public persona to diverge from
-- the character the way a feed profile does, which is exactly what the
-- kind column on platforms was there to let differ.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  platform_id uuid not null references public.platforms(id) on delete cascade,
  kind text not null check (kind in ('direct', 'group')),
  name text, -- optional; group chats can have one, falls back to listing participants when unset
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  -- Pinning and "have I seen the latest message" are both per-participant,
  -- not properties of the conversation itself.
  pinned boolean not null default false,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  unique (conversation_id, character_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_character_id uuid not null references public.characters(id) on delete cascade,
  content text,
  media_url text,
  -- Manually toggleable "Read" status (direct conversations only in the
  -- UI) — fabricated like everything else's stats, not a real receipt
  -- tied to actual viewing.
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_messages_conversation_created on public.messages (conversation_id, created_at);

-- Same shape as is_world_member: conversation_participants' own SELECT
-- policy can't check itself without recursing, so this runs as a
-- security definer to look it up without triggering the policy it's
-- used inside of.
create or replace function public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants cp
    join public.characters c on c.id = cp.character_id
    where cp.conversation_id = _conversation_id and c.owner_id = _user_id
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create policy "conversations_select_participant" on public.conversations for select using (
  public.is_conversation_participant(id, auth.uid())
);
create policy "conversations_insert_own" on public.conversations for insert with check (
  created_by = auth.uid()
);

create policy "conversation_participants_select_participant" on public.conversation_participants for select using (
  public.is_conversation_participant(conversation_id, auth.uid())
);
-- Only the conversation's own creator can seed its participant list —
-- covers adding OTHER people's characters to a DM/group you're starting.
create policy "conversation_participants_insert_by_creator" on public.conversation_participants for insert with check (
  exists (
    select 1 from public.conversations conv
    where conv.id = conversation_participants.conversation_id and conv.created_by = auth.uid()
  )
);
-- Needed so a participant can toggle their own pinned/last_read_at.
create policy "conversation_participants_update_own" on public.conversation_participants for update using (
  exists (select 1 from public.characters c where c.id = conversation_participants.character_id and c.owner_id = auth.uid())
);

create policy "messages_select_participant" on public.messages for select using (
  public.is_conversation_participant(conversation_id, auth.uid())
);
create policy "messages_insert_own_character" on public.messages for insert with check (
  exists (select 1 from public.characters c where c.id = messages.sender_character_id and c.owner_id = auth.uid())
  and public.is_conversation_participant(conversation_id, auth.uid())
);
-- Permissive on purpose: read_at is fabricated narrative state (like a
-- post's like count), not a real security boundary, and one real user
-- can legitimately own both sides of a conversation.
create policy "messages_update_participant" on public.messages for update using (
  public.is_conversation_participant(conversation_id, auth.uid())
);
