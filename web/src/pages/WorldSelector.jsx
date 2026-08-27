import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';

// Lists worlds the logged-in user is a member of.
export default function WorldSelector() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [worlds, setWorlds] = useState([]);
  const [loading, setLoading] = useState(true);
  // Tracks which world (by id) is currently mid-delete, so we can disable
  // just that one button and show "Deleting…" without touching the others.
  const [deletingId, setDeletingId] = useState(null);

  const [showJoinForm, setShowJoinForm] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState(null);
  const [joining, setJoining] = useState(false);

  async function fetchWorlds() {
    setLoading(true);
    // owner_id is now included — we need it client-side to decide whether
    // to show the delete button for each world.
    const { data, error } = await supabase
      .from('worlds')
      .select('id, name, description, owner_id');

    if (error) {
      console.error('Error fetching worlds:', error);
    } else {
      setWorlds(data ?? []);
    }
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
    setJoining(true);

    // The actual join happens inside redeem_invite (a security definer
    // function) — it validates the code, adds this user as a member, and
    // bumps the invite's use count, all atomically. See 0012_redeem_invite.sql.
    const { data: worldId, error } = await supabase.rpc('redeem_invite', {
      _code: inviteCode.trim().toLowerCase(),
    });

    setJoining(false);

    if (error) {
      setJoinError(error.message);
      return;
    }

    navigate(`/worlds/${worldId}`);
  }

  if (loading) return <p>Loading worlds…</p>;

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Your Worlds</h1>
      {worlds.length === 0 && <p>You haven't joined any worlds yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {worlds.map((world) => (
          <li
            key={world.id}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.25rem 0' }}
          >
            <Link to={`/worlds/${world.id}`}>{world.name}</Link>
            {/* Only render the delete button when this world's owner_id
                matches the logged-in user's id — plain JS comparison,
                nothing React-specific about the check itself. */}
            {world.owner_id === user.id && (
              <button
                onClick={() => handleDelete(world)}
                disabled={deletingId === world.id}
                style={{ color: 'crimson' }}
              >
                {deletingId === world.id ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Link className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }} to="/worlds/new">
          + Create a World
        </Link>
        <button type="button" onClick={() => setShowJoinForm((v) => !v)}>
          {showJoinForm ? 'Cancel' : 'Join with Invite Code'}
        </button>
      </div>

      {showJoinForm && (
        <form
          onSubmit={handleRedeem}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid #ddd', padding: '0.75rem', marginTop: '0.75rem', maxWidth: 320 }}
        >
          <label>
            Invite code
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>
          {joinError && <p style={{ color: 'crimson' }}>{joinError}</p>}
          <button type="submit" disabled={joining || !inviteCode.trim()}>
            {joining ? 'Joining…' : 'Join World'}
          </button>
        </form>
      )}
    </div>
  );
}
