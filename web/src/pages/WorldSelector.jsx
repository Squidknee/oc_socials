import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { monogram } from '../lib/names.js';
import './worlds.css';

// Lists worlds the logged-in user is a member of.
export default function WorldSelector() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [worlds, setWorlds] = useState([]);
  const [loading, setLoading] = useState(true);
  // Tracks which world (by id) is currently mid-delete, so we can disable
  // just that one button and show "Deleting…" without touching the others.
  const [deletingId, setDeletingId] = useState(null);

  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState(null);
  const [redeeming, setRedeeming] = useState(false);

  async function fetchWorlds() {
    setLoading(true);
    // owner_id is needed client-side to decide whether to show the delete
    // button for each world. world_stats (0019) is a separate query, not
    // a PostgREST embed — it's a view with no real foreign key back to
    // worlds for PostgREST to auto-detect, so merge the two client-side.
    const [{ data: worldRows, error }, { data: statsRows }] = await Promise.all([
      supabase.from('worlds').select('id, name, description, owner_id'),
      supabase.from('world_stats').select('world_id, character_count, member_count, post_count'),
    ]);

    if (error) {
      console.error('Error fetching worlds:', error);
      setLoading(false);
      return;
    }

    const statsByWorld = new Map((statsRows ?? []).map((s) => [s.world_id, s]));
    setWorlds(worldRows.map((w) => ({ ...w, ...statsByWorld.get(w.id) })));
    setLoading(false);
  }

  useEffect(() => {
    fetchWorlds();
  }, []);

  async function handleDelete(world) {
    // window.confirm is a plain browser API, not React-specific — same as
    // vanilla JS. Cheap guard against a misclick, given this is permanent
    // and cascades to every character/post/comment inside the world.
    const confirmed = window.confirm(
      `Delete "${world.name}"? This permanently removes every character and post inside it. This can't be undone.`
    );
    if (!confirmed) return;

    setDeletingId(world.id);

    // The DELETE RLS policy (owner_id = auth.uid()) is the real
    // enforcement here — this check is just a UX nicety so non-owners
    // never see the button in the first place.
    const { error } = await supabase.from('worlds').delete().eq('id', world.id);

    setDeletingId(null);

    if (error) {
      console.error('Error deleting world:', error);
      alert(`Couldn't delete world: ${error.message}`);
      return;
    }

    // Update local state directly instead of re-fetching — filter() returns
    // a new array with the deleted world removed, which is enough to make
    // React re-render without an extra round-trip to the database.
    setWorlds((prev) => prev.filter((w) => w.id !== world.id));
  }

  async function handleRedeem(e) {
    e.preventDefault();
    setJoinError(null);
    setRedeeming(true);

    // The actual join happens inside redeem_invite (a security definer
    // function) — it validates the code, adds this user as a member, and
    // bumps the invite's use count, all atomically. See 0012_redeem_invite.sql.
    const { data: worldId, error } = await supabase.rpc('redeem_invite', {
      _code: code.trim().toLowerCase(),
    });

    setRedeeming(false);

    if (error) {
      setJoinError(error.message);
      return;
    }

    navigate(`/worlds/${worldId}`);
  }

  if (loading) return <p style={{ padding: '1rem' }}>Loading worlds…</p>;

  return (
    <div className="worlds-page">
      <div className="worlds-head">
        <div className="worlds-headings">
          <h1 className="worlds-title">Your Worlds</h1>
          <p className="worlds-sub">
            {worlds.length === 0
              ? "You haven't joined any worlds yet."
              : `${worlds.length} invite-only ${worlds.length === 1 ? 'world' : 'worlds'}. Pick one to step into.`}
          </p>
        </div>
        <Link className="btn-primary" style={{ textDecoration: 'none' }} to="/worlds/new">
          + Create a World
        </Link>
      </div>

      <form className="worlds-redeem" onSubmit={handleRedeem}>
        <span className="worlds-redeem-label">Got an invite?</span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste a code — 7QK4-M2ZD"
        />
        <button type="submit" disabled={!code.trim() || redeeming}>
          {redeeming ? 'Joining…' : 'Join'}
        </button>
      </form>
      {joinError && <p style={{ color: 'crimson', margin: 0 }}>{joinError}</p>}

      <div className="worlds-grid">
        {worlds.map((world) => (
          <Link className="world-card" to={`/worlds/${world.id}`} key={world.id}>
            <div className="world-card-top">
              <span className="world-mono">{monogram(world.name)}</span>
              <span className="world-card-identity">
                <span className="world-name">{world.name}</span>
                <span className={`world-role${world.owner_id === user.id ? '' : ' is-member'}`}>
                  {world.owner_id === user.id ? 'Owner' : 'Member'}
                </span>
              </span>
              {world.owner_id === user.id && (
                <button
                  type="button"
                  className="world-delete"
                  aria-label={`Delete ${world.name}`}
                  title="Delete world"
                  disabled={deletingId === world.id}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(world); }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" />
                  </svg>
                </button>
              )}
            </div>

            {world.description && <p className="world-card-desc">{world.description}</p>}

            <div className="world-card-meta">
              <span>{world.character_count ?? 0} characters</span>
              <span className="meta-dot" />
              <span>{world.member_count ?? 0} members</span>
              <span className="meta-dot" />
              <span>{world.post_count ?? 0} posts</span>
            </div>
          </Link>
        ))}

        <Link className="world-card-new" to="/worlds/new">
          <span className="world-card-new-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
          </span>
          <span className="world-card-new-title">Create a World</span>
          <span className="world-card-new-sub">Set a scene, get a code to share.</span>
        </Link>
      </div>
    </div>
  );
}
