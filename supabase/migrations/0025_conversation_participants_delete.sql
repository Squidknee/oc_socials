-- Lets a character leave/delete a conversation from their own side —
-- removing just their conversation_participants row, not the
-- conversation or its messages. That matches how real messaging apps
-- handle "delete conversation" (it disappears from your list; the other
-- participant's copy is untouched) and avoids one side being able to
-- unilaterally destroy a chat history that belongs to someone else too.
--
-- Same ownership shape as conversation_participants_update_own (0014).
create policy "conversation_participants_delete_own" on public.conversation_participants for delete using (
  exists (select 1 from public.characters c where c.id = conversation_participants.character_id and c.owner_id = auth.uid())
);
