-- Adds a toggleable "verified" flag per platform account — not per
-- character, since a character's presence (and whether it's verified)
-- differs per platform, matching everything else platform_accounts
-- already does independently of the master character.
alter table public.platform_accounts add column verified boolean not null default false;

-- Two generic columns Twitter needs, placed directly on posts the same
-- way 0007 added `location` — a column any platform can use, not every
-- platform will:
--   retweet_count - purely a fabricated, editable display number (the
--     repost button itself is decorative only, so there's no real
--     "who reposted" mechanic to add on top of it, unlike likes).
--   client_label  - the "posted via ___" text under a tweet.
alter table public.posts add column retweet_count int not null default 0;
alter table public.posts add column client_label text;
