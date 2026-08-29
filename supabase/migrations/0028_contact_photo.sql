-- Lets a character set a custom photo for how they see the other
-- participant in a direct conversation, same idea as overriding a
-- contact's photo in a real phone's address book — it only changes what
-- I see, not the other character's actual profile. Stored on MY OWN
-- participant row (not theirs), so the existing
-- conversation_participants_update_own policy (0014) already covers it —
-- no new RLS needed.
alter table public.conversation_participants add column contact_photo_url text;
