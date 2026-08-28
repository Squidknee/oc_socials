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
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: updateError } = await supabase
      .from('worlds')
      .update({ name, description: description || null, avatar_url: avatarUrl || null })
      .eq('id', world.id)
      .select('id, name, description, avatar_url, owner_id')
      .single();

    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onSaved?.(data);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid #ddd', padding: '0.75rem', marginTop: '0.5rem', maxWidth: 420 }}
    >
      <label>
        Name
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ display: 'block', width: '100%' }} />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ display: 'block', width: '100%' }} />
      </label>
      <label>
        Logo
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="Image URL"
            style={{ flexGrow: 1 }}
          />
          <UploadButton accept="image/*" onUploaded={(url) => setAvatarUrl(url)} onError={setError} />
        </div>
      </label>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
