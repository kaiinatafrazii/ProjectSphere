import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const userNavigation = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid', end: true },
  { to: '/dashboard/projects', label: 'My projects', icon: 'layers', end: true },
  { to: '/dashboard/projects/new', label: 'Submit a project', icon: 'plus' },
  { to: '/dashboard/bookmarks', label: 'Bookmarks', icon: 'bookmark' },
  { to: '/dashboard/reviews', label: 'Ratings & reviews', icon: 'star' },
  { to: '/dashboard/profile', label: 'My profile', icon: 'user' },
];

const adminNavigation = [
  { to: '/admin', label: 'Overview', icon: 'grid', end: true },
  { to: '/admin/projects', label: 'All projects', icon: 'layers', end: true },
  { to: '/admin/projects/pending', label: 'Pending reviews', icon: 'clock' },
  { to: '/admin/projects/approved', label: 'Approved projects', icon: 'check' },
  { to: '/admin/projects/rejected', label: 'Rejected projects', icon: 'close' },
  { to: '/admin/users', label: 'User management', icon: 'users' },
  { to: '/admin/moderation-history', label: 'Moderation history', icon: 'history' },
];

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/dashboard/projects': 'My projects',
  '/dashboard/projects/new': 'Submit a project',
  '/dashboard/bookmarks': 'Bookmarks',
  '/dashboard/reviews': 'Ratings & reviews',
  '/dashboard/profile': 'My profile',
  '/admin': 'Overview',
  '/admin/projects': 'All projects',
  '/admin/projects/pending': 'Pending reviews',
  '/admin/projects/approved': 'Approved projects',
  '/admin/projects/rejected': 'Rejected projects',
  '/admin/users': 'User management',
  '/admin/moderation-history': 'Moderation history',
};

function NavigationIcon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    bookmark: <><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z" /></>,
    star: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.7-3.6 3.3-5.5 7.5-5.5s6.8 1.9 7.5 5.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.5-3.2 2.5-5 6-5s5.5 1.8 6 5M16 5.5a3 3 0 0 1 0 5.8M17 15c2.4.4 3.7 2 4 5" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function DashboardLayout({ admin = false }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const menuToggleRef = useRef(null);
  const closeButtonRef = useRef(null);
  const wasDrawerOpen = useRef(false);
  const navigation = admin ? adminNavigation : userNavigation;
  const title = pageTitles[location.pathname] || (admin ? 'Administration' : 'Workspace');
  const isNavigationActive = (item, isActive) => {
    if (item.to === '/dashboard/projects') {
      return location.pathname === item.to || /^\/dashboard\/projects\/[^/]+\/edit$/.test(location.pathname);
    }
    return isActive;
  };

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (drawerOpen) {
      closeButtonRef.current?.focus();
      wasDrawerOpen.current = true;
    } else if (wasDrawerOpen.current) {
      menuToggleRef.current?.focus();
      wasDrawerOpen.current = false;
    }
  }, [drawerOpen]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !drawerOpen) return;
      const sidebar = document.getElementById('dashboard-sidebar');
      const focusable = sidebar?.querySelectorAll('a[href], button:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError('');
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
    <div className={`dashboard-shell${collapsed ? ' is-collapsed' : ''}${admin ? ' is-admin' : ''}`}>
      {drawerOpen ? <button className="dashboard-backdrop" type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} /> : null}
      <aside
        id="dashboard-sidebar"
        className={`dashboard-sidebar${drawerOpen ? ' is-open' : ''}`}
        aria-label={admin ? 'Administrator navigation' : 'Dashboard navigation'}
        role={drawerOpen ? 'dialog' : undefined}
        aria-modal={drawerOpen ? 'true' : undefined}
      >
        <div className="dashboard-brand-row">
          <Link to="/" className="dashboard-brand" aria-label="ProjectSphere public homepage">
            <img src="/favicon.svg" alt="" />
            <span>ProjectSphere</span>
          </Link>
          <button ref={closeButtonRef} type="button" className="dashboard-icon-button dashboard-mobile-close" aria-label="Close navigation" onClick={() => setDrawerOpen(false)}>×</button>
        </div>
        <p className="dashboard-nav-label">{admin ? 'Administration' : 'Workspace'}</p>
        <nav className="dashboard-nav" aria-label={admin ? 'Admin sections' : 'Dashboard sections'}>
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `dashboard-nav-link${isNavigationActive(item, isActive) ? ' active' : ''}`}
              title={collapsed ? item.label : undefined}
              onClick={() => setDrawerOpen(false)}
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="dashboard-sidebar-bottom">
          <Link to="/" className="dashboard-nav-link public-site-link" title={collapsed ? 'View public website' : undefined} onClick={() => setDrawerOpen(false)}>
            <span className="public-site-icon" aria-hidden="true">↗</span>
            <span>View public website</span>
          </Link>
          <div className="dashboard-account">
            <img src={user?.avatarUrl || '/favicon.svg'} alt="" />
            <div className="dashboard-account-copy">
              <strong>{user?.name || 'Account'}</strong>
              <span>{user?.email || (admin ? 'Administrator' : 'Member')}</span>
            </div>
          </div>
          <button className="dashboard-nav-link dashboard-logout" type="button" title={collapsed ? 'Logout' : undefined} onClick={handleLogout} disabled={loggingOut}>
            <span className="logout-icon" aria-hidden="true">↪</span>
            <span>{loggingOut ? 'Logging out…' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-header">
          <button
            ref={menuToggleRef}
            type="button"
            className="dashboard-icon-button dashboard-menu-toggle"
            aria-label="Open dashboard navigation"
            aria-expanded={drawerOpen}
            aria-controls="dashboard-sidebar"
            onClick={() => setDrawerOpen(true)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <button
            type="button"
            className="dashboard-icon-button dashboard-collapse-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            <span aria-hidden="true">☷</span>
          </button>
          <div className="dashboard-header-title">
            <div className="dashboard-breadcrumb"><Link to={admin ? '/admin' : '/dashboard'}>{admin ? 'Admin' : 'Workspace'}</Link><span aria-hidden="true">/</span><strong>{title}</strong></div>
            <h1>{title}</h1>
          </div>
          <Link to="/" className="dashboard-header-home">Public site <span aria-hidden="true">↗</span></Link>
        </header>
        <main className="dashboard-content">
          {logoutError ? <p className="error-text dashboard-alert" role="alert">{logoutError}</p> : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
