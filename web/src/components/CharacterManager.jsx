import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { downloadCharacterFile } from '../lib/characterFile.js';
import CopyCharacterForm from './CopyCharacterForm.jsx';
import ImportCharacterForm from './ImportCharacterForm.jsx';

export default function CharacterManager({ worldId }) {
  const { user } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  // Tracks which character (by id) currently has its "copy" form open —
  // null means none. Only one at a time keeps the UI from getting
  // cluttered with multiple open forms.
  const [copyingId, setCopyingId] = useState(null);

  const [newHandle, setNewHandle] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [newBio, setNewBio] = useState('');
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  async function fetchCharacters() {
    setLoading(true);
    // Scoped to "your characters in THIS world" — owner_id and world_id
    // both filtered. Other members' characters show up in the feed via
    // their posts, but aren't something you can manage here.
    const { data, error } = await supabase
      .from('characters')
      .select('id, handle, display_name, avatar_url, bio, world_id')
      .eq('world_id', worldId)
      .eq('owner_id', user.id);

    if (error) {
      console.error('Error fetching characters:', error);
    } else {
      setCharacters(data ?? []);
    }
    setLoading(false);
  }

  // worldId is in the dependency array — if the user navigates to a
  // different world, this re-runs and fetches that world's characters
  // instead of leaving the old list on screen.
  useEffect(() => {
    fetchCharacters();
  }, [worldId, user.id]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);

    const { error } = await supabase.from('characters').insert({
      owner_id: user.id,
      world_id: worldId,
      handle: newHandle,
      display_name: newDisplayName,
      avatar_url: newAvatarUrl || null,
      bio: newBio || null,
    });

    setCreating(false);

    if (error) {
      setCreateError(error.code === '23505' ? 'That handle is already taken in this world.' : error.message);
      return;
    }

    // Reset the form fields and hide it, then refresh the list.
    setNewHandle('');
    setNewDisplayName('');
    setNewAvatarUrl('');
    setNewBio('');
    setShowCreateForm(false);
    fetchCharacters();
  }

  if (loading) return <p>Loading characters…</p>;

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem' }}>
      <h2>Your Characters in This World</h2>

      {characters.length === 0 && <p>You don't have a character here yet.</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {characters.map((character) => (
          <li key={character.id} style={{ borderBottom: '1px solid #eee', padding: '0.5rem 0' }}>
            <strong>{character.display_name}</strong> <span>@{character.handle}</span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button onClick={() => downloadCharacterFile(character)}>Export</button>
              <button
                onClick={() => setCopyingId(copyingId === character.id ? null : character.id)}
              >
                {copyingId === character.id ? 'Cancel' : 'Copy to Another World'}
              </button>
            </div>

            {/* Only the character currently being copied gets its form
                rendered — comparing copyingId to this character's id. */}
            {copyingId === character.id && (
              <CopyCharacterForm
                character={character}
                onCopied={() => {
                  setCopyingId(null);
                  fetchCharacters();
                }}
                onCancel={() => setCopyingId(null)}
              />
            )}
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? 'Cancel' : '+ New Character'}
        </button>
        <button onClick={() => setShowImportForm((v) => !v)}>
          {showImportForm ? 'Cancel' : 'Import Character from File'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          <label>
            Handle
            <input type="text" value={newHandle} onChange={(e) => setNewHandle(e.target.value)} required />
          </label>
          <label>
            Display name
            <input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} required />
          </label>
          <label>
            Avatar URL (optional)
            <input type="url" value={newAvatarUrl} onChange={(e) => setNewAvatarUrl(e.target.value)} />
          </label>
          <label>
            Bio (optional)
            <textarea value={newBio} onChange={(e) => setNewBio(e.target.value)} />
          </label>
          {createError && <p style={{ color: 'crimson' }}>{createError}</p>}
          <button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create Character'}
          </button>
        </form>
      )}

      {showImportForm && (
        <ImportCharacterForm
          worldId={worldId}
          onImported={() => {
            setShowImportForm(false);
            fetchCharacters();
          }}
          onCancel={() => setShowImportForm(false)}
        />
      )}
    </div>
  );
}
