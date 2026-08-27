import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { fetchViewerAccountsBySlug } from '../lib/platformAccounts.js';
import CharacterManager from '../components/CharacterManager.jsx';
import Post from '../components/posts/Post.jsx';

const RECENT_POSTS_LIMIT = 5;

// Hub for a world: your characters (and everyone else's), an invite
// button for bringing friends in, and a small "what's new" preview of
// recent activity across every platform. Full per-platform timelines
// still live at /worlds/:worldId/platforms/:slug — not linked from here
// anymore, since this page is meant to be character-first.
export default function WorldFeed() {
  const { worldId } = useParams();
  const { user } = useAuth();
  const [world, setWorld] = useState(null);
  const [otherCharacters, setOtherCharacters] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [viewerAccountsBySlug, setViewerAccountsBySlug] = useState({});
  const [inviteCode, setInviteCode] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  useEffect(() => {
    async function fetchWorld() {
      const { data } = await supabase.from('worlds').select('name, owner_id').eq('id', worldId).single();
      setWorld(data);
    }

    async function fetchOtherCharacters() {
      const { data } = await supabase
        .from('characters')
        .select('id, handle, display_name, avatar_url')
        .eq('world_id', worldId)
        .neq('owner_id', user.id);
      setOtherCharacters(data ?? []);
    }

    async function fetchRecentPosts() {
      const { data } = await supabase
        .from('posts')
        .select(
          'id, content, created_at, base_like_count, retweet_count, client_label, media_url, media_kind, platform_accounts ( id, handle, display_name, avatar_url, verified, platforms ( slug, name ) )'
        )
        .eq('world_id', worldId)
        .order('created_at', { ascending: false })
        .limit(RECENT_POSTS_LIMIT);
      setRecentPosts(data ?? []);
    }

    fetchWorld();
    fetchOtherCharacters();
    fetchRecentPosts();
    fetchViewerAccountsBySlug({ worldId, userId: user.id }).then(setViewerAccountsBySlug);
  }, [worldId, user.id]);

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
    setInviteCode(data.code);
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>{world?.name ?? 'World'}</h1>
        {/* Only owners/mods can create invites (matches world_invites'
            insert policy) — mods don't exist in the UI yet, so this is
            effectively owner-only for now. */}
        {world?.owner_id === user.id && (
          <button className="btn-primary" type="button" onClick={handleGenerateInvite} disabled={generatingInvite}>
            {generatingInvite ? 'Generating…' : 'Invite to World'}
          </button>
        )}
      </div>

      {inviteCode && (
        <div className="invite-row" style={{ maxWidth: 360, marginTop: '0.75rem', marginBottom: '1rem' }}>
          <span className="invite-code">{inviteCode}</span>
          <button
            className="copy-btn"
            type="button"
            aria-label="Copy invite code"
            onClick={() => navigator.clipboard?.writeText(inviteCode)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          </button>
        </div>
      )}

      <CharacterManager worldId={worldId} />

      {otherCharacters.length > 0 && (
        <>
          <span className="section-label">Other Characters in This World</span>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            {otherCharacters.map((character) => (
              <li key={character.id} style={{ padding: '0.4rem 0' }}>
                <Link to={`/characters/${character.id}`}>
                  <strong>{character.display_name}</strong>
                </Link>{' '}
                <span>@{character.handle}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <span className="section-label">What's New</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
        {recentPosts.length === 0 && <p>No posts yet in this world.</p>}
        {recentPosts.map((post) => (
          <Post
            key={post.id}
            post={post}
            viewerAccountId={viewerAccountsBySlug[post.platform_accounts?.platforms?.slug] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
