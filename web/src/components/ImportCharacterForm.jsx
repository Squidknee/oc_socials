import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { usePlatforms } from '../lib/PlatformsContext.jsx';
import { parseCharacterFile } from '../lib/characterFile.js';
import { seedPlatformAccounts } from '../lib/platformAccounts.js';

// Lets a user upload a character exported by ANYONE (a friend who made a
// character for them, their own export from another world, etc.) and add
// it as a new character they own in the current world. Ownership always
// becomes the importing user, regardless of who originally exported it —
// there's no concept of "gifting" an existing character record itself,
// just handing over the data to recreate it.
export default function ImportCharacterForm({ worldId, onImported, onCancel }) {
  const { user } = useAuth();
  const { platforms } = usePlatforms();
  // "parsed" holds the file's contents once successfully read, so we can
  // show an editable preview before actually inserting anything.
  const [parsed, setParsed] = useState(null);
  const [handle, setHandle] = useState('');
  const [fileError, setFileError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFileChange(e) {
    setFileError(null);
    setParsed(null);

    const file = e.target.files[0];
    if (!file) return;

    // FileReader is a browser API for reading a File object's contents —
    // this is the same object you'd get from <input type="file"> in
    // plain JS, React doesn't change how file inputs work.
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = parseCharacterFile(reader.result);
        setParsed(data);
        setHandle(data.handle);
      } catch (err) {
        setFileError(err.message);
      }
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const { data: character, error } = await supabase
      .from('characters')
      .insert({
        owner_id: user.id,
        world_id: worldId,
        handle,
        display_name: parsed.display_name,
        avatar_url: parsed.avatar_url,
        bio: parsed.bio,
      })
      .select()
      .single();

    if (error) {
      setSubmitting(false);
      if (error.code === '23505') {
        setSubmitError('That handle is already taken in this world — try a different one.');
      } else {
        setSubmitError(error.message);
      }
      return;
    }

    await seedPlatformAccounts({ character, worldId, platforms });

    setSubmitting(false);
    onImported?.();
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: '0.75rem', marginTop: '0.5rem' }}>
      <label>
        Character file (.json)
        <input type="file" accept="application/json" onChange={handleFileChange} />
      </label>
      {fileError && <p style={{ color: 'crimson' }}>{fileError}</p>}

      {/* Only show the confirm form once a file has been successfully
          parsed — "parsed &&" skips rendering entirely otherwise. */}
      {parsed && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          <p>
            Importing <strong>{parsed.display_name}</strong>
          </p>
          <label>
            Handle in this world
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
            />
          </label>
          {submitError && <p style={{ color: 'crimson' }}>{submitError}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Importing…' : 'Confirm Import'}
            </button>
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
