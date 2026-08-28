import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Edits a world's name/description. worlds_update_owner (0018) is the
// real enforcement — this only ever renders for the owner in the first
// place (see WorldFeed), same UX-nicety-on-top-of-RLS pattern as
// WorldSelector's delete button.
export default function EditWorldForm({ world, onSaved, onCancel }) {
  const [name, setName] = useState(world.name);
  const [description, setDescription] = useState(world.description ?? '');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: updateError } = await supabase
      .from('worlds')
      .update({ name, description: description || null })
      .eq('id', world.id)
      .select('id, name, description, owner_id')
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
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
