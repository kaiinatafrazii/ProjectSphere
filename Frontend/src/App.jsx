import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
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
import DashboardPage from './pages/DashboardPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import SavedProjectsPage from './pages/SavedProjectsPage.jsx';
import DashboardReviewsPage from './pages/DashboardReviewsPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import AdminContactMessagesPage from './pages/AdminContactMessagesPage.jsx';
import AdminProfilePage from './pages/AdminProfilePage.jsx';
import CreatorProfilePage from './pages/CreatorProfilePage.jsx';

const pageMetadata = [
  { match: (path) => path === '/', title: 'ProjectSphere — Discover and share developer projects', description: 'Discover remarkable developer projects, share your work, explore technologies, and learn from community reviews.' },
  { match: (path) => path === '/discover' || path === '/explore', title: 'Discover Projects — ProjectSphere', description: 'Search and explore projects shared by developers, students, and research teams.' },
  { match: (path) => path.startsWith('/projects/'), title: 'Project details — ProjectSphere', description: 'Explore a project, its technologies, and community feedback on ProjectSphere.' },
  { match: (path) => path.startsWith('/creators/'), title: 'Creator profile — ProjectSphere', description: 'Explore a ProjectSphere creator profile and published projects.' },
  { match: (path) => path === '/login', title: 'Log in — ProjectSphere', description: 'Log in to your ProjectSphere account.' },
  { match: (path) => path === '/admin/login', title: 'Administrator login — ProjectSphere', description: 'Sign in to the ProjectSphere administration dashboard.' },
  { match: (path) => path === '/register', title: 'Create an account — ProjectSphere', description: 'Create a ProjectSphere profile to publish projects and take part in the community.' },
  { match: (path) => path.startsWith('/dashboard/projects/new') || path.startsWith('/dashboard/projects/') || path === '/publish', title: 'Share a Project — ProjectSphere', description: 'Publish your project and share its story with the ProjectSphere community.' },
  { match: (path) => path === '/dashboard/profile' || path === '/profile', title: 'Your Profile — ProjectSphere', description: 'View your ProjectSphere creator profile and published work.' },
  { match: (path) => path === '/dashboard/bookmarks' || path === '/saved', title: 'Saved Projects — ProjectSphere', description: 'Revisit projects you have saved on ProjectSphere.' },
  { match: (path) => path.startsWith('/dashboard'), title: 'Project Dashboard — ProjectSphere', description: 'Manage your projects and account on ProjectSphere.' },
  { match: (path) => path.startsWith('/admin'), title: 'Administration — ProjectSphere', description: 'Review project submissions and platform records.' },
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
  return user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="page-shell center-block"><div className="empty-state" role="status">Restoring your session…</div></div>;
  }
  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return user.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
}

function LegacyPublishRedirect() {
  const location = useLocation();
  const editId = new URLSearchParams(location.search).get('edit');
  return <Navigate to={editId ? `/dashboard/projects/${encodeURIComponent(editId)}/edit` : '/dashboard/projects/new'} replace />;
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
        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="explore" element={<Navigate to="/discover" replace />} />
          <Route path="about" element={<Navigate to="/#about" replace />} />
          <Route path="contact" element={<Navigate to="/#contact" replace />} />
          <Route path="projects/:id" element={<ProjectDetailsPage />} />
          <Route path="creators/:id" element={<CreatorProfilePage />} />
          <Route path="login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<DashboardPage />} />
          <Route path="projects/new" element={<PublishPage />} />
          <Route path="projects/:id/edit" element={<PublishPage />} />
          <Route path="bookmarks" element={<SavedProjectsPage />} />
          <Route path="reviews" element={<DashboardReviewsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="admin" element={<AdminRoute><DashboardLayout admin /></AdminRoute>}>
          <Route index element={<AdminPage />} />
          <Route path="projects" element={<AdminPage />} />
          <Route path="projects/pending" element={<AdminPage />} />
          <Route path="projects/approved" element={<AdminPage />} />
          <Route path="projects/rejected" element={<AdminPage />} />
          <Route path="users" element={<AdminPage />} />
          <Route path="reviews" element={<AdminPage />} />
          <Route path="moderation-history" element={<AdminPage />} />
          <Route path="contact-messages" element={<AdminContactMessagesPage />} />
          <Route path="profile" element={<AdminProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="publish" element={<ProtectedRoute><LegacyPublishRedirect /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><Navigate to="/dashboard/profile" replace /></ProtectedRoute>} />
        <Route path="saved" element={<ProtectedRoute><Navigate to="/dashboard/bookmarks" replace /></ProtectedRoute>} />
      </Routes>
      <CookieNotice />
    </>
  );
}
