import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const landingSections = [
  ['home', 'Home'],
  ['about', 'About'],
  ['features', 'Features'],
  ['how-it-works', 'How It Works'],
  ['testimonials', 'Testimonials'],
  ['contact', 'Contact'],
];

export default function Layout() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const [activeSection, setActiveSection] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const handleOutsideClick = (event) => {
      if (menuOpen && headerRef.current && !headerRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveSection('');
      return undefined;
    }

    const sections = landingSections
      .map(([id]) => document.getElementById(id))
      .filter(Boolean);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: '-22% 0px -62% 0px', threshold: [0, 0.1, 0.35, 0.6] }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [location.pathname]);

  const navigateToSection = (event, id) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setMenuOpen(false);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (location.pathname !== '/') {
      navigate(`/#${id}`);
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      }, 50);
      return;
    }

    navigate(`/#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  };

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
      {isAuthRoute ? (
        <header className="topbar auth-topbar">
          <div className="container auth-topbar-content">
            <Link to="/" className="header-back-home">← Back to Home</Link>
          </div>
        </header>
      ) : (
        <header ref={headerRef} className={scrolled ? 'topbar is-scrolled' : 'topbar'}>
          <div className="container nav-wrap">
            <NavLink to="/" end className="brand" aria-label="ProjectSphere home">
              <img className="brand-mark-image" src="/favicon.svg" alt="" />
              <span>ProjectSphere</span>
            </NavLink>

            <button
              type="button"
              className="menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>

            <nav id="primary-navigation" className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
              <NavLink to="/discover" className={({ isActive }) => isActive ? 'active' : undefined}>Explore</NavLink>
              {landingSections.map(([id, label]) => (
                <a
                  key={id}
                  href={`/#${id}`}
                  className={activeSection === id ? 'active' : undefined}
                  aria-current={activeSection === id ? 'location' : undefined}
                  onClick={(event) => navigateToSection(event, id)}
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="nav-actions">
              {loading ? <span className="user-greeting" role="status">Checking session…</span> : user ? (
                <>
                  <Link to="/dashboard" className="secondary-button nav-profile">Dashboard</Link>
                  <Link to="/saved" className="secondary-button nav-profile">Saved</Link>
                  {user.role === 'admin' ? <Link to="/admin" className="secondary-button nav-profile">Admin</Link> : null}
                  <Link to="/profile" className="secondary-button nav-profile">My profile</Link>
                  <Link to="/publish" className="primary-button">Share project</Link>
                  <button className="secondary-button" type="button" onClick={handleLogout} disabled={loggingOut}>
                    {loggingOut ? 'Logging out…' : 'Logout'}
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className="secondary-button">Login</NavLink>
                  <NavLink to="/register" className="primary-button">Get Started</NavLink>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      <main>
        {logoutError ? (
          <div className="container" role="alert">
            <p className="error-text">{logoutError}</p>
          </div>
        ) : null}
        <Outlet />
      </main>
      {!isAuthRoute ? (
        <footer className="site-footer">
          <div className="container footer-content">
            <NavLink to="/" className="brand" aria-label="ProjectSphere home">
              <img className="brand-mark-image" src="/favicon.svg" alt="" />
              <span>ProjectSphere</span>
            </NavLink>
            <p>Discover, publish, and improve technical work together.</p>
            <nav aria-label="Footer navigation">
              <Link to="/discover">Explore projects</Link>
              {landingSections.map(([id, label]) => (
                <a key={id} href={`/#${id}`} onClick={(event) => navigateToSection(event, id)}>{label}</a>
              ))}
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms &amp; Conditions</Link>
            </nav>
            <small>© {new Date().getFullYear()} ProjectSphere</small>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
