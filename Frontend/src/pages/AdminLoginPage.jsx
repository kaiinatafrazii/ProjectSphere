import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminLoginPage() {
  const { user, loading, authenticating, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const loginAttempt = useRef(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && !loginAttempt.current) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    loginAttempt.current = true;
    setError('');
    try {
      const response = await login(form);
      if (response.user?.role !== 'admin') {
        await logout();
        setError('This account does not have administrator access.');
        return;
      }
      const returnTo = location.state?.from;
      const destination = typeof returnTo === 'string' &&
        (returnTo === '/admin' || returnTo.startsWith('/admin/')) &&
        !returnTo.startsWith('/admin/login')
        ? returnTo
        : '/admin';
      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.');
    }
  };

  if (loading) {
    return <div className="page-shell center-block"><div className="empty-state" role="status">Restoring your session…</div></div>;
  }
  if (user && !loginAttempt.current) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return (
    <div className="page-shell auth-page">
      <div className="auth-card">
        <Link to="/" className="dashboard-brand"><img src="/favicon.svg" alt="" /><span>ProjectSphere</span></Link>
        <span className="eyebrow">Administrator access</span>
        <h1>Log in to administration</h1>
        <form onSubmit={handleSubmit} className="stacked-form compact-form">
          <label>
            Email
            <input type="email" name="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} autoComplete="username" required />
          </label>
          <PasswordField
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            autoComplete="current-password"
          />
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          <button type="submit" className="primary-button full-width" disabled={authenticating}>
            {authenticating ? 'Signing in…' : 'Log in'}
          </button>
        </form>
        <p className="auth-switch"><Link to="/">Return to the public website</Link></p>
      </div>
    </div>
  );
}
