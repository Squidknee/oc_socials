import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import UploadButton from '../UploadButton.jsx';

// Edits a platform_accounts row directly — handle/display name/avatar/bio
// are already independently editable per platform per 0007's design, this
// is just the first UI that actually lets you do it. Not platform-skinned:
// unlike posts/composers/profiles, the fields you're editing here are the
// same regardless of which platform this account is on.
export default function EditAccountForm({ account, onSaved, onCancel }) {
  const [handle, setHandle] = useState(account.handle);
  const [displayName, setDisplayName] = useState(account.display_name);
  const [avatarUrl, setAvatarUrl] = useState(account.avatar_url ?? '');
  const [bio, setBio] = useState(account.bio ?? '');
  const [verified, setVerified] = useState(account.verified);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: updateError } = await supabase
      .from('platform_accounts')
      .update({
        handle,
        display_name: displayName,
        avatar_url: avatarUrl || null,
        bio: bio || null,
        verified,
      })
      .eq('id', account.id)
      .select('id, handle, display_name, avatar_url, bio, verified, world_id, character_id, characters ( owner_id, is_public ), platforms ( * )')
      .single();

    setSubmitting(false);

    if (updateError) {
      setError(updateError.code === '23505' ? 'That handle is already taken on this platform in this world.' : updateError.message);
      return;
    }

    onSaved?.(data);
  }

  return (
    <form className="panel" style={{ maxWidth: 420, margin: '0 auto 1.25rem' }} onSubmit={handleSubmit}>
      <h2 className="panel-title" style={{ fontSize: '1.2rem' }}>Edit account</h2>

      <div className="field">
        <label htmlFor="acct-handle">Handle</label>
        <input id="acct-handle" className="handle-input" type="text" value={handle} onChange={(e) => setHandle(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="acct-name">Display name</label>
        <input id="acct-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="acct-avatar">Avatar URL</label>
        <div className="field-with-upload">
          <input id="acct-avatar" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          <UploadButton accept="image/*" className="upload-btn" onUploaded={(url) => setAvatarUrl(url)} onError={setError} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="acct-bio">Bio</label>
        <textarea id="acct-bio" value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text)', fontFamily: 'Agdasima, sans-serif' }}>
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        Verified
      </label>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button className="btn-primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
        <button className="text-link" type="button" style={{ border: 'none', background: 'none', cursor: 'pointer' }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
