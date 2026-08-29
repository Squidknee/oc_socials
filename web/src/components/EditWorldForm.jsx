import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import UploadButton from './UploadButton.jsx';

// Edits a world's name/description/logo. worlds_update_owner (0018) is
// the real enforcement — this only ever renders for the owner in the
// first place (see WorldFeed), same UX-nicety-on-top-of-RLS pattern as
// WorldSelector's delete button.
export default function EditWorldForm({ world, onSaved, onCancel }) {
  const [name, setName] = useState(world.name);
  const [description, setDescription] = useState(world.description ?? '');
  const [avatarUrl, setAvatarUrl] = useState(world.avatar_url ?? '');
  const [publicCharactersEnabled, setPublicCharactersEnabled] = useState(world.public_characters_enabled ?? false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: updateError } = await supabase
      .from('worlds')
      .update({
        name,
        description: description || null,
        avatar_url: avatarUrl || null,
        public_characters_enabled: publicCharactersEnabled,
      })
      .eq('id', world.id)
      .select('id, name, description, avatar_url, owner_id, public_characters_enabled')
      .single();

    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onSaved?.(data);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', paddingTop: '1rem', maxWidth: 420 }}>
      <div className="field">
        <label htmlFor="edit-world-name">Name</label>
        <input id="edit-world-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="edit-world-desc">Description</label>
        <textarea id="edit-world-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="edit-world-logo">Logo</label>
        <div className="field-with-upload">
          <input
            id="edit-world-logo"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="Image URL"
          />
          <UploadButton accept="image/*" className="upload-btn" onUploaded={(url) => setAvatarUrl(url)} onError={setError} />
        </div>
      </div>
      <div className="toggle-row">
        <span>Enable Public Characters</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={publicCharactersEnabled}
            onChange={(e) => setPublicCharactersEnabled(e.target.checked)}
          />
          <span className="toggle-switch-track">
            <span className="toggle-switch-knob" />
          </span>
        </label>
      </div>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button className="btn-primary" type="submit" disabled={submitting} style={{ flexGrow: 0 }}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button className="text-link" type="button" onClick={onCancel} style={{ border: 'none', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
