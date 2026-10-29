import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiRequest } from '../services/api.js';

const emptyStats = {
  totalProjects: 0,
  publishedProjects: 0,
  pendingProjects: 0,
  projectsNeedingChanges: 0,
  totalReviews: 0,
  averageRating: null,
  savedProjects: 0,
};

const statusLabels = {
  draft: 'Draft',
  pending: 'Pending review',
  published: 'Published',
  featured: 'Featured',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
};

export default function DashboardPage() {
  const location = useLocation();
  const [stats, setStats] = useState(emptyStats);
  const [projects, setProjects] = useState([]);
  const [activity, setActivity] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('recent');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');

  const loadDashboard = async () => {
    setError('');
    try {
      const [dashboard, myProjects] = await Promise.all([
        apiRequest('/projects/dashboard'),
        apiRequest('/projects/mine'),
      ]);
      setStats({ ...emptyStats, ...dashboard.stats });
      setActivity(dashboard.recentActivity || []);
      setRecentReviews(dashboard.recentReviews || []);
      setProjects(myProjects.projects || []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load your dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const visibleProjects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return projects
      .filter((project) => statusFilter === 'all' || project.status === statusFilter)
      .filter((project) => categoryFilter === 'all' || project.category === categoryFilter)
      .filter((project) => !needle || `${project.title} ${project.tagline} ${project.category}`.toLowerCase().includes(needle))
      .sort((a, b) => sortOrder === 'oldest'
        ? new Date(a.createdAt) - new Date(b.createdAt)
        : new Date(b.createdAt) - new Date(a.createdAt));
  }, [projects, search, statusFilter, categoryFilter, sortOrder]);

  const removeProject = async (project) => {
    if (!window.confirm(`Remove "${project.title}" from your projects?`)) return;
    setDeletingId(project.id);
    setError('');
    try {
      await apiRequest(`/projects/${encodeURIComponent(project.id)}`, { method: 'DELETE' });
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setStats((current) => ({ ...current, totalProjects: Math.max(0, Number(current.totalProjects) - 1) }));
    } catch (removeError) {
      setError(removeError.message || 'Unable to remove this project.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="page-shell dashboard-page">
      <div className="container">
        <div className="dashboard-heading">
          <div className="section-heading left-aligned">
            <span className="eyebrow">Your workspace</span>
            <h1>Project dashboard</h1>
            <p>Manage your submissions and follow their progress.</p>
          </div>
          <Link className="primary-button" to="/publish">New project</Link>
        </div>

        {location.state?.notice ? <p className="success-text" role="status">{location.state.notice}</p> : null}
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        {loading ? <div className="empty-state" role="status">Loading your project dashboard…</div> : (
          <>
            <section className="dashboard-stats" aria-label="Project statistics">
              <article><span>Total projects</span><strong>{stats.totalProjects}</strong></article>
              <article><span>Published</span><strong>{stats.publishedProjects}</strong></article>
              <article><span>Pending review</span><strong>{stats.pendingProjects}</strong></article>
              <article><span>Needs attention</span><strong>{stats.projectsNeedingChanges}</strong></article>
              <article><span>Reviews received</span><strong>{stats.totalReviews}</strong></article>
              <article><span>Average rating</span><strong>{stats.averageRating ?? '—'}</strong></article>
              <article><span>Saved projects</span><strong>{stats.savedProjects}</strong></article>
            </section>

            <section className="dashboard-section" aria-labelledby="my-projects-heading">
              <div className="dashboard-section-heading">
                <h2 id="my-projects-heading">My projects</h2>
                <div className="dashboard-filters">
                  <label>
                    <span className="visually-hidden">Search your projects</span>
                    <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" />
                  </label>
                  <label>
                    <span className="visually-hidden">Filter by status</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="all">All statuses</option>
                      {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="visually-hidden">Filter by category</span>
                    <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                      <option value="all">All categories</option>
                      {[...new Set(projects.map((project) => project.category))].sort().map((category) => <option value={category} key={category}>{category}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="visually-hidden">Sort projects</span>
                    <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                      <option value="recent">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </label>
                </div>
              </div>

              {!visibleProjects.length ? (
                <div className="empty-state">
                  <strong>{projects.length ? 'No projects match these filters.' : 'You have not shared a project yet.'}</strong>
                  {!projects.length ? <p>Publish your first project to start receiving community feedback.</p> : null}
                  {!projects.length ? <Link className="primary-button" to="/publish">Share a project</Link> : null}
                </div>
              ) : (
                <div className="dashboard-project-list">
                  {visibleProjects.map((project) => (
                    <article className="dashboard-project" key={project.id}>
                      {project.screenshotUrl ? <img src={project.screenshotUrl} alt="" loading="lazy" /> : <div className="dashboard-project-placeholder" aria-hidden="true">PS</div>}
                      <div className="dashboard-project-info">
                        <div className="dashboard-project-title">
                          <h3>{project.title}</h3>
                          <span className={`status-badge status-${project.status}`}>{statusLabels[project.status] || project.status}</span>
                        </div>
                        <p>{project.tagline}</p>
                        <small>{project.category} · {project.reviewCount} reviews{project.ratingAverage ? ` · ${project.ratingAverage} average` : ''}</small>
                        {project.moderationFeedback ? (
                          <p className="moderation-feedback"><strong>Moderator feedback:</strong> {project.moderationFeedback}</p>
                        ) : null}
                      </div>
                      <div className="dashboard-project-actions">
                        {['published', 'featured'].includes(project.status) ? <Link className="secondary-button" to={`/projects/${encodeURIComponent(project.id)}`}>Preview</Link> : null}
                        {project.status !== 'removed' ? <Link className="secondary-button" to={`/publish?edit=${encodeURIComponent(project.id)}`}>Edit</Link> : null}
                        <button className="secondary-button" type="button" onClick={() => removeProject(project)} disabled={deletingId === project.id}>
                          {deletingId === project.id ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="dashboard-section" aria-labelledby="recent-reviews-heading">
              <h2 id="recent-reviews-heading">Recent reviews</h2>
              {!recentReviews.length ? <div className="empty-state">No community reviews yet.</div> : (
                <ul className="activity-list">
                  {recentReviews.map((review) => (
                    <li key={`${review.projectId}-${review.createdAt}`}>
                      <div><strong>{review.projectTitle}</strong><span>{review.reviewerName} · {'★'.repeat(review.rating)}</span></div>
                      <p>{review.comment}</p>
                      <time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString()}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dashboard-section" aria-labelledby="recent-activity-heading">
              <h2 id="recent-activity-heading">Recent moderation feedback</h2>
              {!activity.length ? <div className="empty-state">No moderation activity yet.</div> : (
                <ul className="activity-list">
                  {activity.map((item) => (
                    <li key={`${item.projectId}-${item.createdAt}`}>
                      <div><strong>{item.projectTitle}</strong><span>{item.action.replaceAll('_', ' ')}</span></div>
                      {item.feedback ? <p>{item.feedback}</p> : null}
                      <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
