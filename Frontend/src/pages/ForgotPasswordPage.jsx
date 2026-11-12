import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/api.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSending(true);
    try {
      const response = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setNotice(response.message || 'If an active account matches that email, reset instructions will be sent.');
    } catch (submitError) {
      setError(submitError.message || 'Unable to request a password reset.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-shell auth-page">
      <section className="auth-card">
        <span className="eyebrow">Account recovery</span>
        <h1>Reset your password</h1>
        <p>Enter the email address associated with your account.</p>
        <form className="stacked-form compact-form" onSubmit={submit}>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          {notice ? <p className="success-text" role="status">{notice}</p> : null}
          <button type="submit" className="primary-button full-width" disabled={sending}>{sending ? 'Sending…' : 'Send reset link'}</button>
        </form>
        <p className="auth-switch"><Link to="/login">Return to login</Link></p>
      </section>
    </div>
  );
}
