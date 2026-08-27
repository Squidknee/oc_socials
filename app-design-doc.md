# OC Social — Design Doc

## Concept
A social-media simulator where real users own multiple fictional "characters," and characters post/interact within sandboxed "Worlds" (communities), similar to how one Discord account can post as different bots/personas across different servers.

---

## Database Schema

### `users`
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| email | text | auth |
| username | text | real-account handle, mostly internal/admin use |
| created_at | timestamp | |

### `worlds`
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| name | text | e.g. "Modern Coffee Shop AU" |
| description | text | |
| owner_id | uuid (FK → users) | world creator/admin |
| visibility | enum | `invite_only` (all worlds — no public/discoverable worlds in v1) |
| created_at | timestamp | |

*Decision: all worlds are invite-only. No public browse/discovery screen needed for v1 — joining happens via invite link or the owner adding a user directly.*

### `world_members`
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| world_id | uuid (FK → worlds) | |
| user_id | uuid (FK → users) | |
| role | enum | `owner`, `mod`, `member` |
| joined_at | timestamp | |

### `world_invites`
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| world_id | uuid (FK → worlds) | |
| code | text | unique invite token/link |
| created_by | uuid (FK → users) | |
| expires_at | timestamp (nullable) | optional expiry |
| max_uses | int (nullable) | optional cap |
| created_at | timestamp | |

Since all worlds are invite-only, this is how new members get in — owner/mod generates a code or link, shares it with a friend, friend redeems it to get added to `world_members`.

### `characters`
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| owner_id | uuid (FK → users) | who controls this character |
| world_id | uuid (FK → worlds) | which world this character "lives" in |
| handle | text | e.g. `@rustyknight`, unique per world |
| display_name | text | |
| avatar_url | text | |
| bio | text | |
| status | enum | `pending`, `approved`, `rejected` — if you want mod approval |
| created_at | timestamp | |

*Decision: users can own multiple characters per world. Constraint is unique `(world_id, handle)` only — so handles can't collide within a world, but one user can have several characters in the same world, and can reuse a handle across different worlds.*

### `posts`
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| character_id | uuid (FK → characters) | author |
| world_id | uuid (FK → worlds) | denormalized for fast feed queries |
| content | text | |
| media_url | text (nullable) | |
| created_at | timestamp | |

### `comments`
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| post_id | uuid (FK → posts) | |
| character_id | uuid (FK → characters) | who's commenting (must be same world) |
| content | text | |
| created_at | timestamp | |

### `likes`
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| post_id | uuid (FK → posts) | |
| character_id | uuid (FK → characters) | |
| created_at | timestamp | |

*(unique constraint on `post_id + character_id` so a character can't like twice)*

### Optional: `follows`
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| follower_character_id | uuid (FK → characters) | |
| followed_character_id | uuid (FK → characters) | |

Lets you do a "following feed" vs. "all-world feed" per character, like real social apps.

---

## Core Screens (wireframe sketch)

### 1. World Selector (landing after login)
```
┌─────────────────────────────┐
│  Your Worlds                 │
│  ┌─────────┐ ┌─────────┐    │
│  │ Coffee   │ │ Sci-Fi   │    │
│  │ Shop AU  │ │ AU       │    │
│  └─────────┘ └─────────┘    │
│  [ + Join / Create World ]   │
└─────────────────────────────┘
```

### 2. World Feed (inside a world)
```
┌─────────────────────────────┐
│ ☰ Coffee Shop AU     [You: @rustyknight ▼]  ← character switcher
├─────────────────────────────┤
│ @luna_b · 2h                 │
│ "the espresso machine broke  │
│  again..."                   │
│ ♡ 12   💬 3                  │
├─────────────────────────────┤
│ @rustyknight · 4h             │
│ "on it, be there in 10"      │
│ ♡ 8   💬 1                   │
├─────────────────────────────┤
│           [ + New Post ]     │
└─────────────────────────────┘
```

### 3. Character Profile
```
┌─────────────────────────────┐
│  [avatar]  Rusty Knight       │
│            @rustyknight       │
│  bio: "fixes things, badly"  │
│  Posts | Likes                │
│  ─────────────────────────   │
│  [post] [post] [post]        │
└─────────────────────────────┘
```

### 4. Character Switcher (modal/dropdown)
```
┌─────────────────────────────┐
│  Post as:                    │
│  ○ @rustyknight (this world) │
│  ○ @newcharacter              │
│  [ + Create Character ]      │
└─────────────────────────────┘
```

---

## Decisions Made
- Users can create multiple characters per world.
- All worlds are invite-only (no public discovery) — joining via invite code/link.

## Still Open
1. DMs between characters — v1 or later?
2. Mod approval required for new characters, or open posting?

## Suggested Stack
- Frontend: React / React Native (Expo)
- Backend: Supabase (Postgres + Auth + Realtime)
- Hosting: Vercel (web) / EAS (mobile)
