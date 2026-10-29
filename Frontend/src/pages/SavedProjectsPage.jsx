import { useEffect, useState } from 'react';
import ProjectCard from '../components/ProjectCard.jsx';
import { apiRequest } from '../services/api.js';
import { Link } from 'react-router-dom';

export default function SavedProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/users/me/bookmarks')
      .then((response) => {
        if (active) setProjects(response.projects || []);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load saved projects.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page-shell narrow-page">
      <section className="section-block">
        <div className="container">
          <div className="section-heading left-aligned">
            <span className="eyebrow">Your collection</span>
            <h1>Saved projects</h1>
            <p>Keep useful projects close and return to them anytime.</p>
          </div>
          {loading ? <div className="empty-state" role="status">Loading saved projects…</div> : null}
          {error ? <div className="empty-state" role="alert">{error}</div> : null}
          {!loading && !error && !projects.length ? (
            <div className="empty-state">
              <strong>No saved projects yet.</strong>
              <p>Explore the catalog and save projects you want to revisit.</p>
              <Link to="/discover" className="primary-button">Explore projects</Link>
            </div>
          ) : null}
          {!loading && !error && projects.length ? (
            <div className="project-grid">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  initialSaved
                  onSavedChange={(saved) => {
                    if (!saved) setProjects((current) => current.filter((item) => item.id !== project.id));
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
