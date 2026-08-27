import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';

// Lists worlds the logged-in user is a member of.
// TODO: add "join via invite code" flow.
export default function WorldSelector() {
  const { user } = useAuth();
  const [worlds, setWorlds] = useState([]);
  const [loading, setLoading] = useState(true);
  // Tracks which world (by id) is currently mid-delete, so we can disable
  // just that one button and show "Deleting…" without touching the others.
  const [deletingId, setDeletingId] = useState(null);

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

      <Link className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }} to="/worlds/new">
        + Create a World
      </Link>

      {/* TODO: button to redeem an invite code */}
    </div>
  );
}
