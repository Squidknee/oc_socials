import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

// Login is username-based, but Supabase Auth itself only knows email
// addresses — accepts either here: an email goes straight to
// resetPasswordForEmail, anything else is looked up as a username first
// (same RPC Login.jsx uses before signing in).
export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    let email = identifier.includes('@') ? identifier : null;
    if (!email) {
      const { data } = await supabase.rpc('get_email_for_username', { _username: identifier });
      email = data;
    }

    // Only actually sends a reset email when this resolved to one, but
    // shows the same message either way — telling the visitor "that
    // username/email doesn't exist" is a way to enumerate real accounts.
    if (email) {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    }

    setSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="login-container">
        <h1 className="login-title">Check your email</h1>
        <p>If that username or email has an account, we've sent a password reset link to the email on file.</p>
        <p>
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="login-container">
      <h1 className="login-title">Reset your password</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label className="login-field-label">
          Username or email
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p>
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  );
}
