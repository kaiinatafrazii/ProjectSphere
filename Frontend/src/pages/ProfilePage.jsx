import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;

      try {
        const userResponse = await apiRequest(`/users/${user.id}`);
        const projectResponse = await apiRequest('/projects');
        setProfile(userResponse.user);
        setProjects((projectResponse.projects || []).filter((project) => project.owner?.id === user.id));
      } catch (error) {
        console.error(error);
      }
    }

    loadProfile();
  }, [user]);

  if (!profile && !user) {
    return <div className="page-shell center-block"><div className="empty-state">Log in to view your profile.</div></div>;
  }

  return (
    <div className="page-shell profile-page">
      <section className="section-block">
        <div className="container profile-layout">
          <div className="profile-card">
            <img src={profile?.avatarUrl || user?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=500&q=80'} alt={profile?.name || user?.name} />
            <div>
              <span className="eyebrow">Creator profile</span>
              <h1>{profile?.name || user?.name}</h1>
              <p>{profile?.bio || 'This builder is ready to share impactful work.'}</p>
              <div className="tech-stack">
                {(profile?.skills || user?.skills || []).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="profile-summary-grid">
            <div className="summary-box">
              <strong>{projects.length}</strong>
              <span>Published projects</span>
            </div>
            <div className="summary-box">
              <strong>{profile?.location || 'Remote'}</strong>
              <span>Location</span>
            </div>
            <div className="summary-box">
              <strong>{profile?.role || user?.role || 'student'}</strong>
              <span>Role</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="container">
          <div className="section-heading left-aligned">
            <span className="eyebrow">My projects</span>
            <h2>Published work</h2>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state">
              No public projects yet. <Link to="/publish">Publish your first project</Link>
            </div>
          ) : (
            <div className="project-grid">
              {projects.map((project) => (
                <div key={project.id} className="mini-project-card">
                  <h3>{project.title}</h3>
                  <p>{project.summary}</p>
                  <Link to={`/projects/${project.id}`} className="link-button">Open project</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
