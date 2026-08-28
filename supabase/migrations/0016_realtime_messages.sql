-- Live message delivery: postgres_changes only broadcasts for tables
-- added to this publication. Broadcast payloads are still filtered by
-- the table's existing SELECT policy per connected client, so
-- messages_select_participant (0014) does the same job here it already
-- does for normal reads — no separate realtime-specific security to add.
alter publication supabase_realtime add table public.messages;
