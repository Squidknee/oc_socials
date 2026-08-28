-- Real "reblog" mechanic for platforms with supports_reblogs = true
-- (Twitter today) — platforms.supports_reblogs has existed since 0007 but
-- nothing ever implemented it; the retweet button has been a disabled
-- placeholder rendering just posts.retweet_count. Same shape as likes:
-- a real per-account toggle whose count layers on top of retweet_count
-- (the composer-set baseline), same pattern as base_like_count + count(likes).
--
-- Recreated to match what's actually live in the database — the original
-- push for this ran against production before this file could be
-- reviewed/approved. Kept as-is per that decision rather than rolled
-- back; the frontend piece (toggle button, usePostInteractions) is still
-- unbuilt, so this table is inert until that lands.

create table public.reblogs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  platform_account_id uuid not null references public.platform_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, platform_account_id)
);
create index idx_reblogs_post on public.reblogs (post_id);

alter table public.reblogs enable row level security;

create policy "reblogs_select_member" on public.reblogs for select using (
  exists (
    select 1 from public.posts p
    join public.world_members m on m.world_id = p.world_id
    where p.id = reblogs.post_id and m.user_id = auth.uid()
  )
);

create policy "reblogs_insert_own_platform_account" on public.reblogs for insert with check (
  exists (
    select 1 from public.platform_accounts pa
    join public.characters c on c.id = pa.character_id
    where pa.id = reblogs.platform_account_id and c.owner_id = auth.uid()
  )
);

create policy "reblogs_delete_own_platform_account" on public.reblogs for delete using (
  exists (
    select 1 from public.platform_accounts pa
    join public.characters c on c.id = pa.character_id
    where pa.id = reblogs.platform_account_id and c.owner_id = auth.uid()
  )
);

-- Same live-update treatment as likes/comments (0017): existing SELECT
-- policy gates what each client receives, replica identity full so a
-- delete's payload carries platform_account_id, not just its own id.
alter publication supabase_realtime add table public.reblogs;
alter table public.reblogs replica identity full;
