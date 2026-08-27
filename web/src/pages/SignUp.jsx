import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import PasswordInput from '../components/PasswordInput.jsx';

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // username is passed as metadata; a DB trigger (0002_auth_trigger.sql)
    // uses it to create the matching public.users row.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    // If email confirmation is on (default for new Supabase projects),
    // there's no session yet — show a "check your email" message instead
    // of redirecting.
    if (!data.session) {
      setConfirmSent(true);
    } else {
      navigate('/');
    }
  }

  if (confirmSent) {
    return (
      <div style={{ padding: '1rem', maxWidth: 360, margin: '2rem auto' }}>
        <h1>Check your email</h1>
        <p>We sent a confirmation link to {email}. Click it to activate your account, then log in.</p>
        <Link to="/login">Back to login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 360, margin: '2rem auto' }}>
      <h1>Sign Up</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label>
          Password
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing up…' : 'Sign Up'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
