-- Per-conversation "Read Receipts" toggle (direct conversations only in
-- the UI). Off just displays "Delivered" instead of the existing manual
-- read_at status (0014) — read_at itself is unaffected either way, since
-- it's already fabricated/manual rather than a real receipt. Any current
-- participant can flip it, same model as renaming a group (0022) — no
-- new RLS policy needed, conversations_update_participant already covers
-- a full-row update.
alter table public.conversations add column read_receipts_enabled boolean not null default true;
