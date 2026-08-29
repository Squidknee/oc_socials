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
  const [isPublic, setIsPublic] = useState(character.is_public ?? false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // Going public is the one direction that actually changes what other
    // people can do (post as, edit) — worth a confirm. Going back private
    // isn't, since it only ever restricts, never surprises anyone with new
    // access.
    if (isPublic && !character.is_public) {
      const confirmed = window.confirm(
        `Make ${character.display_name} public? Anyone in this world will be able to post as them, comment/like as them, and edit their platform account bios/avatars. You can make them private again later.`
      );
      if (!confirmed) return;
    }

    setSubmitting(true);

    const { data, error: updateError } = await supabase
      .from('characters')
      .update({
        handle,
        display_name: displayName,
        avatar_url: avatarUrl || null,
        bio: bio || null,
        is_public: isPublic,
      })
      .eq('id', character.id)
      .select('id, handle, display_name, avatar_url, bio, world_id, is_public')
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', paddingTop: '1rem' }}>
      <div className="field">
        <label htmlFor="edit-char-handle">Handle</label>
        <input id="edit-char-handle" type="text" value={handle} onChange={(e) => setHandle(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="edit-char-name">Display name</label>
        <input id="edit-char-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="edit-char-avatar">Avatar</label>
        <div className="field-with-upload">
          <input id="edit-char-avatar" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          <UploadButton accept="image/*" className="upload-btn" onUploaded={(url) => setAvatarUrl(url)} onError={setError} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="edit-char-bio">Bio</label>
        <textarea id="edit-char-bio" value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div className="toggle-row">
        <span>Public (anyone in this world can post/edit as them)</span>
        <label className="toggle-switch">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
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
