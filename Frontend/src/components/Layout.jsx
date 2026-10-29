import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container nav-wrap">
          <NavLink to="/" className="brand" aria-label="ProjectSphere home">
            <span className="brand-mark">P</span>
            <span>ProjectSphere</span>
          </NavLink>

          <nav className="main-nav" aria-label="Main navigation">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/discover">Discover</NavLink>
            <NavLink to="/publish">Publish</NavLink>
            {user ? <NavLink to="/profile">Profile</NavLink> : null}
          </nav>

          <div className="nav-actions">
            {user ? (
              <>
                <span className="user-greeting">Hi, {user.name.split(' ')[0]}</span>
                <button className="secondary-button" onClick={logout}>Logout</button>
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
        <Outlet />
      </main>
    </div>
  );
}
