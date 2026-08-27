import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { usePlatforms } from '../lib/PlatformsContext.jsx';
import { seedPlatformAccounts } from '../lib/platformAccounts.js';

// Shown inline when the user clicks "Copy" on one of their characters.
// Lets them pick a destination world (from worlds they belong to) and
// confirm/edit the handle, since handles must be unique per world and the
// source handle might already be taken in the destination.
export default function CopyCharacterForm({ character, onCopied, onCancel }) {
  const { user } = useAuth();
  const { platforms } = usePlatforms();
  const [worlds, setWorlds] = useState([]);
  const [targetWorldId, setTargetWorldId] = useState('');
  const [handle, setHandle] = useState(character.handle);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch every world this user belongs to, so they can pick where to
  // send the copy. This is a "join" through world_members — Supabase lets
  // you reach into a related table with `worlds ( ... )` inside select().
  useEffect(() => {
    async function fetchWorlds() {
      const { data, error } = await supabase
        .from('world_members')
        .select('world_id, worlds ( id, name )')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching worlds:', error);
        return;
      }

      const list = (data ?? []).map((row) => row.worlds);
      setWorlds(list);
      // Default to the first world that ISN'T the character's current
      // world, since copying into the same world is a less common case —
      // but we still allow it (see the <select>, nothing excludes it).
      const firstOther = list.find((w) => w.id !== character.world_id);
      setTargetWorldId((firstOther ?? list[0])?.id ?? '');
    }

    fetchWorlds();
  }, [user.id, character.world_id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data: copy, error } = await supabase
      .from('characters')
      .insert({
        owner_id: user.id,
        world_id: targetWorldId,
        handle,
        display_name: character.display_name,
        avatar_url: character.avatar_url,
        bio: character.bio,
      })
      .select()
      .single();

    if (error) {
      setSubmitting(false);
      // Postgres error code 23505 = unique constraint violation. We know
      // the only unique constraint on this table is (world_id, handle),
      // so we can give a specific, actionable message instead of the raw
      // database error text.
      if (error.code === '23505') {
        setError('That handle is already taken in the destination world — try a different one.');
      } else {
        setError(error.message);
      }
      return;
    }

    await seedPlatformAccounts({ character: copy, worldId: targetWorldId, platforms });

    setSubmitting(false);
    onCopied?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid #ddd', padding: '0.75rem', marginTop: '0.5rem' }}
    >
      <label>
        Copy to world
        <select value={targetWorldId} onChange={(e) => setTargetWorldId(e.target.value)} required>
          {worlds.map((world) => (
            <option key={world.id} value={world.id}>
              {world.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Handle in that world
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          required
        />
      </label>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={submitting || !targetWorldId}>
          {submitting ? 'Copying…' : 'Copy Character'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
