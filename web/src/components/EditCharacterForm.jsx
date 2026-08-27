import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import UploadButton from './UploadButton.jsx';

// Edits a character's master profile — separate from EditAccountForm,
// which edits one platform_account and deliberately doesn't sync back to
// the character (per 0007's design: seeded once, then independent).
export default function EditCharacterForm({ character, onSaved, onCancel }) {
  const [handle, setHandle] = useState(character.handle);
  const [displayName, setDisplayName] = useState(character.display_name);
  const [avatarUrl, setAvatarUrl] = useState(character.avatar_url ?? '');
  const [bio, setBio] = useState(character.bio ?? '');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: updateError } = await supabase
      .from('characters')
      .update({
        handle,
        display_name: displayName,
        avatar_url: avatarUrl || null,
        bio: bio || null,
      })
      .eq('id', character.id)
      .select('id, handle, display_name, avatar_url, bio, world_id')
      .single();

    setSubmitting(false);

    if (updateError) {
      if (updateError.code === '23505') {
        setError(updateError.message.includes('display_name') ? 'That name is already taken in this world.' : 'That handle is already taken in this world.');
      } else {
        setError(updateError.message);
      }
      return;
    }

    onSaved?.(data);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid #ddd', padding: '0.75rem', marginTop: '0.5rem' }}
    >
      <label>
        Handle
        <input type="text" value={handle} onChange={(e) => setHandle(e.target.value)} required />
      </label>
      <label>
        Display name
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      <label>
        Avatar
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} style={{ flexGrow: 1 }} />
          <UploadButton accept="image/*" onUploaded={(url) => setAvatarUrl(url)} onError={setError} />
        </div>
      </label>
      <label>
        Bio
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
