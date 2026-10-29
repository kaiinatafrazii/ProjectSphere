import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import CookieNotice from './components/CookieNotice.jsx';
import { useAuth } from './context/AuthContext.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ProjectDetailsPage from './pages/ProjectDetailsPage.jsx';
import PublishPage from './pages/PublishPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import TermsPage from './pages/TermsPage.jsx';

const pageMetadata = [
  { match: (path) => path === '/', title: 'ProjectSphere — Discover and share developer projects', description: 'Discover remarkable developer projects, share your work, explore technologies, and learn from community reviews.' },
  { match: (path) => path === '/discover', title: 'Discover Projects — ProjectSphere', description: 'Search and explore projects shared by developers, students, and research teams.' },
  { match: (path) => path.startsWith('/projects/'), title: 'Project details — ProjectSphere', description: 'Explore a project, its technologies, and community feedback on ProjectSphere.' },
  { match: (path) => path === '/login', title: 'Log in — ProjectSphere', description: 'Log in to your ProjectSphere account.' },
  { match: (path) => path === '/register', title: 'Create an account — ProjectSphere', description: 'Create a ProjectSphere profile to publish projects and take part in the community.' },
  { match: (path) => path === '/publish', title: 'Share a Project — ProjectSphere', description: 'Publish your project and share its story with the ProjectSphere community.' },
  { match: (path) => path === '/profile', title: 'Your Profile — ProjectSphere', description: 'View your ProjectSphere creator profile and published work.' },
  { match: (path) => path === '/privacy', title: 'Privacy Policy — ProjectSphere', description: 'Read how ProjectSphere handles account, project, contact, and session information.' },
  { match: (path) => path === '/terms', title: 'Terms & Conditions — ProjectSphere', description: 'Read the terms for using ProjectSphere.' },
];

function PageMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const metadata = pageMetadata.find((item) => item.match(pathname)) || {
      title: 'Page not found — ProjectSphere',
      description: 'The requested ProjectSphere page could not be found.',
    };
    document.title = metadata.title;
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content = metadata.description;

    for (const [property, content] of [
      ['og:title', metadata.title],
      ['og:description', metadata.description],
      ['og:url', `${window.location.origin}${pathname}`],
      ['og:image', `${window.location.origin}/images/social-preview.svg`],
      ['twitter:title', metadata.title],
      ['twitter:description', metadata.description],
      ['twitter:image', `${window.location.origin}/images/social-preview.svg`],
    ]) {
      let tag = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        if (property.startsWith('og:')) tag.setAttribute('property', property);
        else tag.setAttribute('name', property);
        document.head.appendChild(tag);
      }
      tag.content = content;
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}${pathname}`;
  }, [pathname]);

  return null;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-shell center-block"><div className="empty-state" role="status">Restoring your session…</div></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return children;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="page-shell center-block"><div className="empty-state" role="status">Restoring your session…</div></div>;
  }
  return user ? <Navigate to="/discover" replace /> : children;
}

function NotFoundPage() {
  return (
    <div className="page-shell center-block">
      <div className="empty-state">
        <h1>Page not found</h1>
        <p>This page may have moved or no longer exists.</p>
        <Link className="primary-button" to="/">Back to home</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <PageMetadata />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="projects/:id" element={<ProjectDetailsPage />} />
          <Route
            path="publish"
            element={
              <ProtectedRoute>
                <PublishPage />
              </ProtectedRoute>
            }
          />
          <Route path="login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <CookieNotice />
    </>
  );
}
