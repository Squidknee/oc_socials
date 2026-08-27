import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { usePlatforms } from '../lib/PlatformsContext.jsx';
import { seedPlatformAccounts } from '../lib/platformAccounts.js';
import UploadButton from '../components/UploadButton.jsx';

// Dedicated page for creating a character within a world — replaces the
// toggle-form that used to live inside CharacterManager's list.
export default function CreateCharacter() {
  const { worldId } = useParams();
  const { user } = useAuth();
  const { platforms } = usePlatforms();
  const navigate = useNavigate();

  const [worldName, setWorldName] = useState('');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchWorld() {
      const { data } = await supabase.from('worlds').select('name').eq('id', worldId).single();
      setWorldName(data?.name ?? '');
    }
    fetchWorld();
  }, [worldId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data: character, error: charError } = await supabase
      .from('characters')
      .insert({
        owner_id: user.id,
        world_id: worldId,
        handle,
        display_name: displayName,
        avatar_url: avatarUrl || null,
        bio: bio || null,
      })
      .select()
      .single();

    if (charError) {
      setSubmitting(false);
      if (charError.code === '23505') {
        setError(charError.message.includes('display_name') ? 'That name is already taken in this world.' : 'That handle is already taken in this world.');
      } else {
        setError(charError.message);
      }
      return;
    }

    await seedPlatformAccounts({ character, worldId, platforms });

    setSubmitting(false);
    navigate(`/characters/${character.id}`);
  }

  return (
    <div className="page-center">
      <div className="panel" style={{ maxWidth: 460 }}>
        <a
          className="back-link"
          href={`/worlds/${worldId}`}
          onClick={(e) => { e.preventDefault(); navigate(`/worlds/${worldId}`); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Back to {worldName || 'this world'}
        </a>

        <div className="panel-heading">
          <h1 className="panel-title">Create a Character</h1>
          <p className="panel-subtitle">Who are they in <span className="accent">{worldName}</span>?</p>
        </div>

        <div className="avatar-preview">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4" /><path d="M4.5 20c1.4-3.6 4.4-5.4 7.5-5.4s6.1 1.8 7.5 5.4" /></svg>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="field">
            <label htmlFor="handle">Handle</label>
            <div className="input-row">
              <span className="input-prefix">@</span>
              <input id="handle" type="text" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="rustyknight" required />
            </div>
          </div>

          <div className="field">
            <label htmlFor="display-name">Display name</label>
            <input id="display-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Rusty Knight" required />
          </div>

          <div className="field">
            <label htmlFor="avatar-url">Avatar <span className="field-optional">(optional)</span></label>
            <div className="field-with-upload">
              <input id="avatar-url" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://... or upload a file" />
              <UploadButton accept="image/*" className="upload-btn" onUploaded={(url) => setAvatarUrl(url)} onError={setError} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="bio">Bio <span className="field-optional">(optional)</span></label>
            <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="fixes things, badly." />
          </div>

          {error && <p style={{ color: 'crimson' }}>{error}</p>}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Character'}
          </button>
        </form>
      </div>
    </div>
  );
}
