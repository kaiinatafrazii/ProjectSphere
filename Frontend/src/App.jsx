import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ProjectDetailsPage from './pages/ProjectDetailsPage.jsx';
import PublishPage from './pages/PublishPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

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
        <a className="primary-button" href="/">Back to home</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
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
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
