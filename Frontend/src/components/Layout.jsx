import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLogoutError('');
    setLoggingOut(true);
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      setLogoutError(error.message || 'Unable to log out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container nav-wrap">
          <NavLink to="/" end className="brand" aria-label="ProjectSphere home">
            <span className="brand-mark">P</span>
            <span>ProjectSphere</span>
          </NavLink>

          <nav className="main-nav" aria-label="Main navigation">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/discover">Discover</NavLink>
            {user ? <NavLink to="/publish">Publish</NavLink> : null}
            {user ? <NavLink to="/profile">Profile</NavLink> : null}
          </nav>

          <div className="nav-actions">
            {loading ? <span className="user-greeting" role="status">Checking session…</span> : user ? (
              <>
                <span className="user-greeting">Hi, {user.name.split(' ')[0]}</span>
                <button className="secondary-button" type="button" onClick={handleLogout} disabled={loggingOut}>
                  {loggingOut ? 'Logging out…' : 'Logout'}
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="secondary-button">Login</NavLink>
                <NavLink to="/register" className="primary-button">Join now</NavLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {logoutError ? (
          <div className="container" role="alert">
            <p className="error-text">{logoutError}</p>
          </div>
        ) : null}
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-content">
          <NavLink to="/" className="brand" aria-label="ProjectSphere home">
            <span className="brand-mark">P</span>
            <span>ProjectSphere</span>
          </NavLink>
          <p>Discover, publish, and improve technical work together.</p>
          <nav aria-label="Footer navigation">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/discover">Discover projects</NavLink>
          </nav>
        </div>
      </footer>
    </div>
  );
}
