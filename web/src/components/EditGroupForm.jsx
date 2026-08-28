import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import UploadButton from './UploadButton.jsx';

// Renames/re-icons a group conversation. conversations_update_participant
// (0022) is the real enforcement — any current participant can use this,
// same "any member" model real group chats use since there's no
// admin/mod concept for conversations.
export default function EditGroupForm({ conversation, onSaved, onCancel }) {
  const [name, setName] = useState(conversation.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(conversation.avatar_url ?? '');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: updateError } = await supabase
      .from('conversations')
      .update({ name: name.trim() || null, avatar_url: avatarUrl || null })
      .eq('id', conversation.id)
      .select('id, kind, name, avatar_url')
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
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}
    >
      <label>
        Group name
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Untitled group" style={{ display: 'block', width: '100%' }} />
      </label>
      <label>
        Group icon
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
      {error && <p style={{ color: 'crimson', margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
