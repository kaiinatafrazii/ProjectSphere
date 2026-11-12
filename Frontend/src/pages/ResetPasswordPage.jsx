import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import { apiRequest } from '../services/api.js';

export default function ResetPasswordPage() {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const response = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setNotice(response.message || 'Password updated. Sign in with your new password.');
      setPassword('');
      setConfirmation('');
    } catch (submitError) {
      setError(submitError.message || 'Unable to reset your password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell auth-page">
      <section className="auth-card">
        <span className="eyebrow">Account recovery</span>
        <h1>Choose a new password</h1>
        {!token ? (
          <div className="empty-state" role="alert">
            <p>This reset link is incomplete or invalid.</p>
            <Link to="/forgot-password" className="secondary-button">Request another link</Link>
          </div>
        ) : (
          <form className="stacked-form compact-form" onSubmit={submit}>
            <PasswordField label="New password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} />
            <p className="field-help">Use at least 12 characters.</p>
            <PasswordField label="Confirm new password" name="confirmPassword" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} />
            {error ? <p className="error-text" role="alert">{error}</p> : null}
            {notice ? <p className="success-text" role="status">{notice}</p> : null}
            <button type="submit" className="primary-button full-width" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button>
          </form>
        )}
        <p className="auth-switch"><Link to="/login">Return to login</Link></p>
      </section>
    </div>
  );
}
