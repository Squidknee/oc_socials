# OC Social

A social-media simulator for original characters (OCs). Real users own multiple fictional characters, and those characters post, comment, DM, and interact with each other inside invite-only "Worlds." Each world runs its own set of social-media clones — right now Instagram and Twitter for public posts, iMessage for private messages — and every character gets an independent account on each one.

## Concept

- **Users** are real people with login accounts (log in by username, not email).
- **Worlds** are invite-only communities/settings (e.g. "Coffee Shop AU," "Sci-Fi AU"). You need an invite code to join one.
- **Characters** belong to a user and live inside a specific world. One user can create and control multiple characters in the same world, each with a unique handle *and* display name within that world.
- **Platforms** (Instagram, Twitter, iMessage) are the "sites" a character can have a presence on. A character's account on a given platform is seeded from their master profile but then independently editable — a character can look, sound, and even be named differently on Twitter than on Instagram.
- **Posts/comments/likes** belong to a platform account, not a bare character — content is authored by a specific platform persona and scoped to the world it's in.
- **Messages** (direct or group) belong to the character directly, not a platform account — DMs don't have a public persona to diverge from the way a feed profile does.

## How it's built

The interesting architectural idea here: every platform-specific feature — how a post renders, how the composer works, how a profile looks — is a **skin** dispatched off the platform's slug, not a hardcoded per-platform screen. Adding a new feed platform means adding one skin file and one registry entry, not rebuilding a page:

- `components/posts/Post.jsx` → `skins/InstagramPost.jsx` / `skins/TwitterPost.jsx`
- `components/composer/PostComposer.jsx` → `skins/InstagramComposer.jsx` / `skins/TwitterComposer.jsx`
- `components/profiles/PlatformProfile.jsx` → `skins/InstagramProfile.jsx` / `skins/TwitterProfile.jsx`

Shared logic that every skin needs (real likes/comments, following) lives in hooks (`usePostInteractions`, `useFollow`) so the skins themselves only handle rendering. Messaging (`conversations`/`messages`) is a separate core for the same reason a `platforms.kind` is either `feed` or `messaging` — a DM has no public profile to model, so it's built on `character_id` directly rather than a platform account.

Where things are deliberately fabricated for roleplay rather than "real": like counts, retweet counts, verified badges, and message read-status are all editable/toggleable by the people controlling the characters — they layer on top of the real underlying mechanic (an actual `likes` row, an actual `follows` row) rather than replacing it.

## Status

Live and working, not just designed. Currently built:

- Auth (username-based login/signup, email confirmation), invite-only worlds with a working invite-code redemption flow
- Multiple characters per world (create, edit, delete, copy to another world, export/import as a file), unique handle *and* display name per world
- **Instagram**: profile pages, a world-wide feed, a composer (caption, carousel media, starting like count, backdating), real likes/comments, a genuine "liked by" (via a real `follows` graph), verified badges
- **Twitter**: same shape, plus retweet counts and a "posted via ___" device label
- **iMessage**: direct + group conversations, pinned conversations, unread tracking, message clustering, image attachments, toggleable read receipts
- Real file uploads (Supabase Storage) for avatars and post/message media, not just pasted URLs
- A from-scratch coffee-toned theme (light background, dark nav, one accent color) replacing the original placeholder styling

## Not decided yet / roadmap

- **Discord** — planned as a second skin on the same messaging core (a channel is structurally a persistent group conversation), once Discord-specific needs (servers/channels) are scoped out
- A real character-switcher — right now, which of your characters you're "acting as" on a feed platform defaults to your first account there rather than an explicit picker
- Live updates (Supabase Realtime) — feeds and conversations currently need a manual refresh to see other people's new activity
- Mod-approval workflow for new characters (the `characters.status` column exists for this but nothing sets it yet)

## Stack

- **Frontend**: React + Vite, plain CSS (no framework), `react-router-dom` for routing
- **Backend**: Supabase (Postgres + Auth + Storage) — all schema/RLS lives in `supabase/migrations`, no server code of its own
- **Hosting**: Vercel (root directory `web`)

## Getting Started

1. **Install dependencies**
   ```
   cd web
   npm install
   ```
2. **Set up Supabase** — create a project at supabase.com, then run every file in `supabase/migrations/` against it, in order (0001 through the highest-numbered file), via the SQL editor or the Supabase CLI.
3. **Environment variables** — copy `.env.example` to `web/.env` and fill in your project's URL and anon key (Project Settings → API in the Supabase dashboard):
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4. **Run it**
   ```
   npm run dev
   ```

## Project Structure

```
supabase/migrations/       → every schema change and RLS policy, in order
web/src/pages/              → routed pages (one per URL)
web/src/components/
  posts/                    → Post.jsx + platform skins + shared like/comment logic
  composer/                 → PostComposer.jsx + platform skins
  profiles/                 → PlatformProfile.jsx + platform skins + EditAccountForm/useFollow
  (top-level components)    → CharacterManager, Copy/Import/Edit character forms, UploadButton, etc.
web/src/lib/                → Supabase client, auth/platforms contexts, shared data helpers
app-design-doc.md           → original concept doc (pre-dates the platform/messaging system)
```
