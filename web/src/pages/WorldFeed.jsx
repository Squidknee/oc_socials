import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { usePlatforms } from '../lib/PlatformsContext.jsx';
import { POST_SELECT, fetchPostById } from '../lib/posts.js';
import { setCurrentWorldId } from '../lib/currentWorld.js';
import { monogram } from '../lib/names.js';
import CharacterManager from '../components/CharacterManager.jsx';
import EditWorldForm from '../components/EditWorldForm.jsx';
import Post from '../components/posts/Post.jsx';
import './worlds.css';

const RECENT_POSTS_LIMIT = 5;

function formatRelativeFuture(dateString) {
  const diffDay = Math.round((new Date(dateString).getTime() - Date.now()) / 86400000);
  if (diffDay <= 0) return 'today';
  if (diffDay === 1) return 'in 1 day';
  return `in ${diffDay} days`;
}

// Hub for a world: your characters (and everyone else's), an invite
// button for bringing friends in, and a small "what's new" preview of
// recent activity across every platform. Full per-platform timelines
// still live at /worlds/:worldId/platforms/:slug — not linked from the
// main column, since this page is meant to be character-first; the
// sidebar's "Platform feeds" panel is the deliberate, low-key way back.
export default function WorldFeed() {
  const { worldId } = useParams();
  const { user } = useAuth();
  const { platforms } = usePlatforms();
  const [world, setWorld] = useState(null);
  const [worldStats, setWorldStats] = useState(null);
  const [otherCharacters, setOtherCharacters] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [platformCounts, setPlatformCounts] = useState([]);
  const [invite, setInvite] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [editWorldOpen, setEditWorldOpen] = useState(false);
  // Candidates for each post's own "act as" picker (see InstagramPost/
  // TwitterPost) — every character you own here, grouped by platform
  // slug. Deliberately not "which one is currently acting" — nothing here
  // persists a choice across posts or interactions; every like/comment
  // prompts you to pick fresh, by design.
  const [myAccountsBySlug, setMyAccountsBySlug] = useState({});

  useEffect(() => {
    async function fetchWorld() {
      // world_stats (0019) isn't a PostgREST embed here — it's a view
      // with no real foreign key for PostgREST to auto-detect, so this
      // is a second query rather than a joined select.
      const [{ data }, { data: stats }] = await Promise.all([
        supabase.from('worlds').select('id, name, description, avatar_url, owner_id').eq('id', worldId).single(),
        supabase.from('world_stats').select('character_count, member_count, post_count').eq('world_id', worldId).maybeSingle(),
      ]);
      setWorld(data);
      setWorldStats(stats);
    }

    async function fetchOtherCharacters() {
      const { data } = await supabase
        .from('characters')
        .select('id, handle, display_name, avatar_url')
        .eq('world_id', worldId)
        .neq('owner_id', user.id);
      setOtherCharacters(data ?? []);
    }

    // Candidates for the per-post "act as" picker — every character you
    // own here, with whichever platform accounts they have. Grouped by
    // slug since a post's picker only ever needs candidates for that
    // post's own platform.
    async function fetchMyAccounts() {
      const { data } = await supabase
        .from('characters')
        .select('id, display_name, avatar_url, platform_accounts ( id, platforms ( slug ) )')
        .eq('world_id', worldId)
        .eq('owner_id', user.id);

      const bySlug = {};
      for (const character of data ?? []) {
        for (const account of character.platform_accounts ?? []) {
          const slug = account.platforms?.slug;
          if (!slug) continue;
          (bySlug[slug] ??= []).push({
            accountId: account.id,
            characterId: character.id,
            displayName: character.display_name,
            avatarUrl: character.avatar_url,
          });
        }
      }
      setMyAccountsBySlug(bySlug);
    }

    async function fetchRecentPosts() {
      const { data } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('world_id', worldId)
        .order('created_at', { ascending: false })
        .limit(RECENT_POSTS_LIMIT);
      setRecentPosts(data ?? []);
    }

    fetchWorld();
    fetchOtherCharacters();
    fetchMyAccounts();
    fetchRecentPosts();
    setCurrentWorldId(worldId);
  }, [worldId, user.id]);

  // Live "What's New": postgres_changes only hands back the raw posts
  // row, so hydrate it with the same join the initial fetch uses before
  // dropping it into the preview list.
  useEffect(() => {
    const channel = supabase
      .channel(`world-posts:${worldId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts', filter: `world_id=eq.${worldId}` },
        async (payload) => {
          const post = await fetchPostById(payload.new.id);
          if (!post) return;
          setRecentPosts((prev) =>
            prev.some((p) => p.id === post.id) ? prev : [post, ...prev].slice(0, RECENT_POSTS_LIMIT)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [worldId]);

  // One head-count per feed platform (there are only two) — Postgres
  // GROUP BY isn't reachable through the JS client, so this is the cheap
  // version rather than an RPC.
  useEffect(() => {
    async function fetchPlatformCounts() {
      const feedPlatforms = platforms.filter((p) => p.kind === 'feed');
      const counts = await Promise.all(
        feedPlatforms.map(async (p) => {
          const { count } = await supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('world_id', worldId)
            .eq('platform_id', p.id);
          return { slug: p.slug, name: p.name, count: count ?? 0 };
        })
      );
      setPlatformCounts(counts);
    }

    if (platforms.length > 0) fetchPlatformCounts();
  }, [worldId, platforms]);

  async function handleGenerateInvite() {
    setGeneratingInvite(true);

    const { data, error } = await supabase
      .from('world_invites')
      .insert({ world_id: worldId, created_by: user.id })
      .select()
      .single();

    setGeneratingInvite(false);

    if (error) {
      alert(`Couldn't create an invite: ${error.message}`);
      return;
    }
    setInvite(data);
  }

  const inviteMeta = invite && [
    invite.expires_at && `Expires ${formatRelativeFuture(invite.expires_at)}`,
    invite.max_uses != null && `${Math.max(0, invite.max_uses - invite.uses)} uses left`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="hub-page">
      <div>
        <Link className="hub-back" to="/">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Your worlds
        </Link>

        <div className="hub-head">
          <div className="hub-head-main">
            <span className="hub-mono">
              {world?.avatar_url ? (
                <img src={world.avatar_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                monogram(world?.name)
              )}
            </span>
            <div className="hub-identity">
              <h1 className="hub-title">{world?.name ?? 'World'}</h1>
              <p className="hub-sub">
                {[
                  world?.description,
                  `${worldStats?.member_count ?? 0} members`,
                  `${worldStats?.character_count ?? 0} characters`,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          {/* Only owners/mods can create invites (matches world_invites'
              insert policy) — mods don't exist in the UI yet, so this is
              effectively owner-only for now. Editing follows the same
              rule (worlds_update_owner, 0018). */}
          {world?.owner_id === user.id && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="hub-btn-quiet" type="button" onClick={() => setEditWorldOpen((v) => !v)}>
                {editWorldOpen ? 'Cancel' : 'Edit World'}
              </button>
              <button className="btn-primary" type="button" onClick={handleGenerateInvite} disabled={generatingInvite}>
                {generatingInvite ? 'Generating…' : 'Invite to World'}
              </button>
            </div>
          )}
        </div>

        {editWorldOpen && world && (
          <EditWorldForm
            world={world}
            onSaved={(updated) => { setWorld(updated); setEditWorldOpen(false); }}
            onCancel={() => setEditWorldOpen(false)}
          />
        )}
      </div>

      <div className="hub-layout">
        <div className="hub-main">
          <CharacterManager worldId={worldId} />

          <div className="hub-feed">
            <div className="hub-section-head">
              <span className="hub-panel-title">What's New</span>
              <span className="hub-panel-note">across every platform</span>
            </div>
            {recentPosts.length === 0 ? (
              <p className="hub-empty">No posts yet in this world.</p>
            ) : (
              // No viewerAccountId here, ever — this feed mixes platforms
              // with no single "acting as" context, and by design nothing
              // persists a choice across interactions. Liking or
              // commenting instead offers a per-interaction "act as"
              // picker (candidateAccounts) built from your characters
              // that have an account on that specific post's platform.
              recentPosts.map((post) => {
                const slug = post.platform_accounts?.platforms?.slug;
                return (
                  <Post
                    key={post.id}
                    post={post}
                    viewerAccountId={null}
                    candidateAccounts={myAccountsBySlug[slug] ?? []}
                  />
                );
              })
            )}
          </div>
        </div>

        <div className="hub-side">
          {invite && (
            <div className="hub-panel padded">
              <span className="hub-panel-label">Invite code</span>
              <div className="invite-row">
                <span className="invite-code">{invite.code}</span>
                <button
                  className="copy-btn"
                  type="button"
                  aria-label="Copy invite code"
                  onClick={() => navigator.clipboard?.writeText(invite.code)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                </button>
              </div>
              {inviteMeta && <span className="hub-invite-meta">{inviteMeta}</span>}
            </div>
          )}

          {platformCounts.length > 0 && (
            <div className="hub-panel padded">
              <span className="hub-panel-label">Platform feeds</span>
              {platformCounts.map((p) => (
                <Link className="platform-link" to={`/worlds/${worldId}/platforms/${p.slug}`} key={p.slug}>
                  {p.name}
                  <span className="platform-link-count">{p.count}</span>
                </Link>
              ))}
            </div>
          )}

          {otherCharacters.length > 0 && (
            <div className="hub-panel padded">
              <span className="hub-panel-label">Other Characters</span>
              {otherCharacters.map((c) => (
                <Link className="side-char" to={`/characters/${c.id}`} key={c.id}>
                  <span className="side-char-avatar">
                    {c.avatar_url ? <img src={c.avatar_url} alt="" /> : monogram(c.display_name)}
                  </span>
                  <span className="side-char-text">
                    <span className="side-char-name">{c.display_name}</span>
                    <span className="side-char-handle">@{c.handle}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
