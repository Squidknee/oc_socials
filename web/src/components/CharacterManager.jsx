import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { downloadCharacterFile } from '../lib/characterFile.js';
import CopyCharacterForm from './CopyCharacterForm.jsx';
import ImportCharacterForm from './ImportCharacterForm.jsx';
import EditCharacterForm from './EditCharacterForm.jsx';

export default function CharacterManager({ worldId }) {
  const { user } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showImportForm, setShowImportForm] = useState(false);
  // Tracks which character (by id) currently has its "copy" form open —
  // null means none. Only one at a time keeps the UI from getting
  // cluttered with multiple open forms.
  const [copyingId, setCopyingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  // Tracks which character (by id) is currently mid-delete, matching the
  // same disable-just-this-button pattern WorldSelector uses for worlds.
  const [deletingId, setDeletingId] = useState(null);

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

  async function handleDelete(character) {
    const confirmed = window.confirm(
      `Delete ${character.display_name}? This permanently removes their posts, platform accounts, comments, and likes. This can't be undone.`
    );
    if (!confirmed) return;

    setDeletingId(character.id);

    // characters_delete_owner RLS is the real enforcement; platform
    // accounts/posts/comments/likes all cascade-delete from here.
    const { error } = await supabase.from('characters').delete().eq('id', character.id);

    setDeletingId(null);

    if (error) {
      console.error('Error deleting character:', error);
      alert(`Couldn't delete character: ${error.message}`);
      return;
    }

    setCharacters((prev) => prev.filter((c) => c.id !== character.id));
  }

  if (loading) return <p>Loading characters…</p>;

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem' }}>
      <h2>Your Characters in This World</h2>

      {characters.length === 0 && <p>You don't have a character here yet.</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {characters.map((character) => (
          <li key={character.id} style={{ borderBottom: '1px solid #eee', padding: '0.5rem 0' }}>
            <Link to={`/characters/${character.id}`}>
              <strong>{character.display_name}</strong>
            </Link>{' '}
            <span>@{character.handle}</span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button onClick={() => setEditingId(editingId === character.id ? null : character.id)}>
                {editingId === character.id ? 'Cancel' : 'Edit'}
              </button>
              <button onClick={() => downloadCharacterFile(character)}>Export</button>
              <button
                onClick={() => setCopyingId(copyingId === character.id ? null : character.id)}
              >
                {copyingId === character.id ? 'Cancel' : 'Copy to Another World'}
              </button>
              <button
                onClick={() => handleDelete(character)}
                disabled={deletingId === character.id}
                style={{ color: 'crimson' }}
              >
                {deletingId === character.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>

            {/* Only the character currently being edited/copied gets its
                form rendered — comparing the id in state to this row's. */}
            {editingId === character.id && (
              <EditCharacterForm
                character={character}
                onSaved={(updated) => {
                  setEditingId(null);
                  setCharacters((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
                }}
                onCancel={() => setEditingId(null)}
              />
            )}

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
        <Link to={`/worlds/${worldId}/characters/new`}>+ New Character</Link>
        <button onClick={() => setShowImportForm((v) => !v)}>
          {showImportForm ? 'Cancel' : 'Import Character from File'}
        </button>
      </div>

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
