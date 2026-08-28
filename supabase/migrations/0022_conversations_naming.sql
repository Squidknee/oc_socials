-- Lets a group conversation be renamed/re-iconed after creation. There
-- was no UPDATE policy on conversations at all before this — only
-- conversation_participants (pinned/last_read_at) had one. Any current
-- participant can rename/re-icon, same "any member" model real group
-- chats use — there's no admin/mod concept for conversations.
alter table public.conversations add column avatar_url text;

create policy "conversations_update_participant" on public.conversations for update using (
  public.is_conversation_participant(id, auth.uid())
);
