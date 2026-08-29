import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import PasswordInput from '../components/PasswordInput.jsx';

// Landed on from the link in the password-reset email. Clicking that link
// makes supabase-js establish a temporary "recovery" session on its own
// (it reads the token out of the URL on load) — this page doesn't do
// anything special to obtain one, it just assumes a session already
// exists by the time it renders and lets updateUser use it.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      // No active recovery session is the most likely cause — an
      // expired or already-used link, or landing here directly.
      setError(updateError.message);
      return;
    }

    navigate('/');
  }

  return (
    <div className="login-container">
      <h1 className="login-title">Set a new password</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label className="login-field-label">
          New password
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label className="login-field-label">
          Confirm password
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  );
}
