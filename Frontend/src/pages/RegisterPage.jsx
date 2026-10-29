import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordField from '../components/PasswordField.jsx';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, authenticating } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    bio: '',
    location: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const response = await register(form);
      navigate(response.user?.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <div className="page-shell auth-page">
      <div className="auth-card">
        <span className="eyebrow">Join the network</span>
        <h1>Create your creator profile</h1>
        <form onSubmit={handleSubmit} className="stacked-form compact-form">
          <label>
            Full name
            <input name="name" value={form.name} onChange={handleChange} autoComplete="name" maxLength={100} required />
          </label>
          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={handleChange} autoComplete="email" required />
          </label>
          <PasswordField
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            minLength={8}
          />
          <p className="field-help">Use 8–72 characters. Your password is never shown or logged.</p>
          <PasswordField
            label="Confirm password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError('');
            }}
            autoComplete="new-password"
          />
          <label>
            Bio
            <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} maxLength={1000} placeholder="Tell the community about your work and interests." />
          </label>
          <label>
            Location
            <input name="location" value={form.location} onChange={handleChange} maxLength={100} placeholder="Your city or region" />
          </label>
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          <button type="submit" className="primary-button full-width" disabled={authenticating}>
            {authenticating ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already a member? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
