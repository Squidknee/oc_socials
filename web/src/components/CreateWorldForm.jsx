import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';
import UploadButton from './UploadButton.jsx';

// props are just a regular JS object passed in as this function's argument —
// JSX components ARE functions, so "props" works exactly like any other
// function parameter. Here we destructure it: { onCreated } pulls the
// onCreated field straight out of whatever object the parent passes in,
// e.g. <CreateWorldForm onCreated={someFunction} />
export default function CreateWorldForm({ onCreated }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // createdWorld/inviteCode are null until a world is successfully created,
  // then hold the new world + its generated code so we can show a success
  // state with a link into the world and something to share with friends.
  const [createdWorld, setCreatedWorld] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);

  async function handleSubmit(e) {
    // e is the DOM submit event, same as vanilla JS. preventDefault() stops
    // the browser's default "reload the page" behavior on form submit.
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Step 1: create the world itself. .select().single() asks Postgres to
    // hand back the row we just inserted (specifically, as one object
    // rather than an array of one) so we have its generated id right away.
    const { data: world, error: worldError } = await supabase
      .from('worlds')
      .insert({ name, description, avatar_url: avatarUrl || null, owner_id: user.id })
      .select()
      .single();

    if (worldError) {
      setError(worldError.message);
      setSubmitting(false);
      return;
    }

    // Step 2: add the creator as a member with role "owner". Without this,
    // the RLS policies (which check world_members) would lock the creator
    // out of their own world on the very next query.
    const { error: memberError } = await supabase
      .from('world_members')
      .insert({ world_id: world.id, user_id: user.id, role: 'owner' });

    if (memberError) {
      setError(memberError.message);
      setSubmitting(false);
      return;
    }

    // Step 3: generate an invite code, since worlds are invite-only —
    // a world with no way to invite anyone would be a dead end.
    // code/expires_at/max_uses all have DB defaults, so we only need to
    // supply which world it's for and who made it.
    const { data: invite, error: inviteError } = await supabase
      .from('world_invites')
      .insert({ world_id: world.id, created_by: user.id })
      .select()
      .single();

    setSubmitting(false);

    if (inviteError) {
      setError(inviteError.message);
      return;
    }

    setCreatedWorld(world);
    setInviteCode(invite.code);
    setName('');
    setDescription('');
    setAvatarUrl('');

    // Let the parent (WorldSelector) know a world was created, so it can
    // refresh its list. "?." is optional chaining — call onCreated only if
    // the parent actually passed one in.
    onCreated?.(world);
  }

  // Once we have an invite code, show a success state instead of the form.
  // This is a common JSX pattern: an early "return" with different markup
  // depending on component state, instead of one big conditional render.
  if (inviteCode) {
    return (
      <div className="panel" style={{ alignItems: 'center', textAlign: 'center', maxWidth: 460 }}>
        <div className="check-badge">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.25" /><path d="M8.2 12.3l2.6 2.6 5-5.4" /></svg>
        </div>

        <h1 className="panel-title">World created!</h1>
        <p className="panel-subtitle accent">{createdWorld.name}</p>

        <div className="field" style={{ width: '100%', textAlign: 'left' }}>
          <label>Invite code</label>
          <div className="invite-row">
            <span className="invite-code">{inviteCode}</span>
            <button
              className="copy-btn"
              type="button"
              aria-label="Copy invite code"
              onClick={() => navigator.clipboard?.writeText(inviteCode)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
            </button>
          </div>
          <span className="helper">Share this with friends so they can join.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>
          <button className="btn-primary" type="button" onClick={() => navigate(`/worlds/${createdWorld.id}`)}>
            Go to World
          </button>
          <button
            className="text-link"
            type="button"
            style={{ border: 'none', cursor: 'pointer' }}
            onClick={() => {
              setInviteCode(null);
              setCreatedWorld(null);
            }}
          >
            Create another world
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ maxWidth: 460 }}>
      <a className="back-link" href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Back to your worlds
      </a>

      <div className="panel-heading">
        <h1 className="panel-title">Create a World</h1>
        <p className="panel-subtitle">Give your community a name and set the scene.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="field">
          <label htmlFor="world-name">World name</label>
          <input
            id="world-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Modern Coffee Shop AU"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="world-desc">Description</label>
          <textarea
            id="world-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this world about? Set the scene for anyone who joins."
          />
        </div>
        <div className="field">
          <label htmlFor="world-avatar">Logo (optional)</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="world-avatar"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="Image URL"
              style={{ flexGrow: 1 }}
            />
            <UploadButton accept="image/*" onUploaded={(url) => setAvatarUrl(url)} onError={setError} />
          </div>
        </div>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create World'}
        </button>
        <span className="helper">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          Worlds are invite-only — you'll get a shareable code once it's created.
        </span>
      </form>
    </div>
  );
}
