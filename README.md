# OC Social

A social-media simulator for original characters (OCs). Real users own multiple fictional characters, and those characters post, comment, and interact with each other inside invite-only "Worlds" — think Twitter/Instagram, but every account is a character you control, and every server is its own self-contained community.

## Concept

- **Users** are real people with login accounts.
- **Worlds** are invite-only communities/settings (e.g. "Coffee Shop AU," "Sci-Fi AU"). You need an invite link to join one.
- **Characters** belong to a user and live inside a specific world. One user can create and control multiple characters in the same world.
- **Posts/Comments/Likes** are made by characters, scoped to the world they belong to — feeds never cross between worlds.

## Status

🚧 Early design phase — no code yet. See [`app-design-doc.md`](./app-design-doc.md) for the full database schema and wireframes.

## Planned Stack

- **Frontend**: React (or React Native / Expo for mobile)
- **Backend**: Supabase (Postgres + Auth + Realtime)
- **Hosting**: Vercel (web) / EAS (mobile)

## Core Features (v1)

- [ ] User auth (signup/login)
- [ ] Create/join Worlds via invite link
- [ ] Create multiple Characters per World
- [ ] Character switcher (post as any of your characters in the current world)
- [ ] World feed (posts from all characters in that world)
- [ ] Character profile pages
- [ ] Comments + likes on posts

## Not Decided Yet

- DMs between characters
- Mod approval workflow for new characters vs. open posting

## Getting Started

_(fill in once the project is scaffolded — install steps, env vars, local dev server, etc.)_

## Project Structure

```
/app or /web       → frontend
/supabase           → SQL migrations, schema, edge functions
app-design-doc.md   → schema + wireframes reference
```
