import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordField from '../components/PasswordField.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authenticating } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await login(form);
      const returnTo = location.state?.from;
      const safeReturnTo =
        typeof returnTo === 'string' &&
        returnTo.startsWith('/') &&
        !returnTo.startsWith('//') &&
        !['/login', '/register'].includes(returnTo);
      navigate(safeReturnTo ? returnTo : '/dashboard', { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <div className="page-shell auth-page">
      <div className="auth-card">
        <span className="eyebrow">Welcome back</span>
        <h1>Log in to ProjectSphere</h1>
        <form onSubmit={handleSubmit} className="stacked-form compact-form">
          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={handleChange} autoComplete="email" required />
          </label>
          <PasswordField
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
          />
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          <button type="submit" className="primary-button full-width" disabled={authenticating}>
            {authenticating ? 'Signing in…' : 'Log in'}
          </button>
        </form>
        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
