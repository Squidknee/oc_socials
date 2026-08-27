import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/AuthContext.jsx';

// props are just a regular JS object passed in as this function's argument —
// JSX components ARE functions, so "props" works exactly like any other
// function parameter. Here we destructure it: { onCreated } pulls the
// onCreated field straight out of whatever object the parent passes in,
// e.g. <CreateWorldForm onCreated={someFunction} />
export default function CreateWorldForm({ onCreated }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // inviteCode is null until a world is successfully created, then holds
  // the generated code so we can show it to the user to share with friends.
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
      .insert({ name, description, owner_id: user.id })
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

    setInviteCode(invite.code);
    setName('');
    setDescription('');

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
      <div style={{ border: '1px solid #ddd', padding: '1rem', marginTop: '1rem' }}>
        <p>World created! Share this invite code with your friends:</p>
        <code style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{inviteCode}</code>
        <br />
        <button onClick={() => setInviteCode(null)} style={{ marginTop: '0.5rem' }}>
          Create another world
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
      <label>
        World name
        <input
          type="text"
          value={name}
          // onChange fires on every keystroke; e.target.value is the
          // input's current text, same DOM API as vanilla JS.
          onChange={(e) => setName(e.target.value)}
          required
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      {/* error && <p>...</p> only renders the <p> when error is truthy —
          React just skips rendering anything for false/null/undefined. */}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create World'}
      </button>
    </form>
  );
}
