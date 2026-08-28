-- Same bug 0005 already fixed for worlds, same shape: MessagesOverview
-- does insert(...).select().single() on conversations, and PostgREST
-- tries to read the new row back immediately. That read needs to pass
-- conversations_select_participant, which requires a
-- conversation_participants row — but participants (including the
-- creator's own character) aren't inserted until the *next* step.
-- You can't see the conversation you just started because you're not
-- "in" it yet.
--
-- Fix: creators can always see conversations they created, participant
-- or not.

drop policy if exists "conversations_select_participant" on public.conversations;

create policy "conversations_select_participant" on public.conversations for select using (
  created_by = auth.uid()
  or public.is_conversation_participant(id, auth.uid())
);
