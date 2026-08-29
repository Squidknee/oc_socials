import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { downloadCharacterFile } from '../lib/characterFile.js';
import { monogram } from '../lib/names.js';
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
      .select('id, handle, display_name, avatar_url, bio, world_id, is_public')
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

    // characters_delete_owner RLS is the real enforcement here; platform
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
    <div className="hub-panel">
      <div className="hub-panel-head">
        <span className="hub-panel-title">Your Characters</span>
        <span className="hub-panel-note">{characters.length} in this world</span>
      </div>

      {characters.length === 0 && (
        <div className="char-row"><span className="char-meta">You don't have a character here yet.</span></div>
      )}

      {characters.map((character) => (
        <Fragment key={character.id}>
          <div className="char-row">
            <span className="char-avatar">
              {character.avatar_url ? (
                <img src={character.avatar_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                monogram(character.display_name)
              )}
            </span>
            <div className="char-info">
              <Link className="char-name" to={`/characters/${character.id}`}>{character.display_name}</Link>
              <span className="char-meta">@{character.handle}</span>
            </div>
            <div className="char-actions">
              <button
                className="char-icon-btn"
                type="button"
                aria-label="Edit"
                title="Edit"
                onClick={() => setEditingId(editingId === character.id ? null : character.id)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L20 8l-4-4L4 16z" /></svg>
              </button>
              <button
                className="char-icon-btn"
                type="button"
                aria-label="Export"
                title="Export"
                onClick={() => downloadCharacterFile(character)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
              </button>
              <button
                className="char-icon-btn"
                type="button"
                aria-label="Copy to another world"
                title="Copy to another world"
                onClick={() => setCopyingId(copyingId === character.id ? null : character.id)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              </button>
              <button
                className="char-icon-btn is-danger"
                type="button"
                aria-label="Delete"
                title="Delete"
                onClick={() => handleDelete(character)}
                disabled={deletingId === character.id}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /></svg>
              </button>
            </div>
          </div>

          {/* Only the character currently being edited/copied gets its
              form rendered — comparing the id in state to this row's. */}
          {editingId === character.id && (
            <div className="char-row-form">
              <EditCharacterForm
                character={character}
                onSaved={(updated) => {
                  setEditingId(null);
                  setCharacters((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
                }}
                onCancel={() => setEditingId(null)}
              />
            </div>
          )}

          {copyingId === character.id && (
            <div className="char-row-form">
              <CopyCharacterForm
                character={character}
                onCopied={() => {
                  setCopyingId(null);
                  fetchCharacters();
                }}
                onCancel={() => setCopyingId(null)}
              />
            </div>
          )}
        </Fragment>
      ))}

      <div className="hub-panel-footer">
        <Link className="hub-btn" to={`/worlds/${worldId}/characters/new`}>+ New Character</Link>
        <button className="hub-btn-quiet" type="button" onClick={() => setShowImportForm((v) => !v)}>
          {showImportForm ? 'Cancel' : 'Import from file'}
        </button>
      </div>

      {showImportForm && (
        <div className="char-row-form">
          <ImportCharacterForm
            worldId={worldId}
            onImported={() => {
              setShowImportForm(false);
              fetchCharacters();
            }}
            onCancel={() => setShowImportForm(false)}
          />
        </div>
      )}
    </div>
  );
}
