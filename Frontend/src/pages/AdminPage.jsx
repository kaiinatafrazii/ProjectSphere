import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiRequest } from '../services/api.js';

export default function AdminPage() {
  const { pathname } = useLocation();
  const view = pathname === '/admin'
    ? 'overview'
    : pathname === '/admin/users'
      ? 'users'
      : pathname === '/admin/reviews'
        ? 'reviews'
      : pathname === '/admin/moderation-history'
        ? 'history'
        : 'projects';
  const routeStatus = pathname.endsWith('/pending')
    ? 'pending'
    : pathname.endsWith('/approved')
      ? 'approved'
      : pathname.endsWith('/rejected')
        ? 'rejected'
        : '';
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadView = async () => {
    setLoading(true);
    setError('');
    try {
      if (view === 'overview') {
        const result = await apiRequest('/admin/overview');
        setOverview(result);
      } else {
        const params = new URLSearchParams({ page: String(page), limit: '25' });
        if (view === 'projects') {
          if (routeStatus || status) params.set('status', routeStatus || status);
          if (search.trim()) params.set('search', search.trim());
        } else if (['users', 'reviews'].includes(view) && search.trim()) {
          params.set('search', search.trim());
        }
        const endpoint = view === 'projects' ? 'projects' : view === 'users' ? 'users' : view === 'reviews' ? 'reviews' : 'history';
        const result = await apiRequest(`/admin/${endpoint}?${params}`);
        setRows(result.projects || result.users || result.reviews || result.history || []);
        setTotal(result.total || 0);
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load administrator data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadView();
  }, [view, page, pathname]);

  const applyFilters = (event) => {
    event.preventDefault();
    if (page === 1) loadView();
    else setPage(1);
  };

  const moderate = async (project, action) => {
    const note = (feedback[project.id] || '').trim();
    if (['reject', 'request_changes', 'remove'].includes(action) && !note) {
      setError('Add feedback before rejecting, requesting changes, or removing a project.');
      return;
    }
    if (action === 'remove' && !window.confirm(`Remove "${project.title}" from public access?`)) return;
    setBusyId(project.id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/admin/projects/${encodeURIComponent(project.id)}/moderate`, {
        method: 'POST',
        body: JSON.stringify({ action, feedback: note }),
      });
      setNotice(`Moderation decision saved for “${project.title}”.`);
      setRows((current) => current.filter((item) => item.id !== project.id));
      setFeedback((current) => ({ ...current, [project.id]: '' }));
    } catch (moderationError) {
      setError(moderationError.message || 'Unable to save this moderation decision.');
    } finally {
      setBusyId('');
    }
  };

  const stats = overview?.stats || {};

  return (
    <div className="page-shell dashboard-page">
      <div className="container">
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        {notice ? <p className="success-text" role="status">{notice}</p> : null}
        {loading ? <div className="empty-state" role="status">Loading administrator data…</div> : null}

        {!loading && view === 'overview' && overview ? (
          <>
            <section className="dashboard-stats" aria-label="Platform statistics">
              <article><span>Total users</span><strong>{stats.totalUsers}</strong></article>
              <article><span>Total projects</span><strong>{stats.totalProjects}</strong></article>
              <article><span>Pending review</span><strong>{stats.pendingProjects}</strong></article>
              <article><span>Published</span><strong>{stats.publishedProjects}</strong></article>
              <article><span>Rejected</span><strong>{stats.rejectedProjects}</strong></article>
              <article><span>Reviews</span><strong>{stats.totalReviews}</strong></article>
            </section>
            <div className="admin-recent-grid">
              <section className="dashboard-section">
                <h2>Recent submissions</h2>
                {!overview.recentProjects?.length ? <div className="empty-state">No projects submitted yet.</div> : (
                  <ul className="activity-list">
                    {overview.recentProjects.map((project) => <li key={project.id}><div><strong>{project.title}</strong><span>{project.ownerName} · {project.status}</span></div></li>)}
                  </ul>
                )}
              </section>
              <section className="dashboard-section">
                <h2>Recent registrations</h2>
                {!overview.recentUsers?.length ? <div className="empty-state">No accounts found.</div> : (
                  <ul className="activity-list">
                    {overview.recentUsers.map((user) => <li key={user.id}><div><strong>{user.name}</strong><span>{user.email}</span></div></li>)}
                  </ul>
                )}
              </section>
            </div>
          </>
        ) : null}

        {!loading && view === 'projects' ? (
          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <h2>Project moderation</h2>
              <form className="dashboard-filters" onSubmit={applyFilters}>
                <label><span className="visually-hidden">Search by project or owner</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Project or owner" /></label>
                {!routeStatus ? <label><span className="visually-hidden">Filter by project status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{['pending', 'changes_requested', 'rejected', 'published', 'featured', 'draft', 'removed'].map((item) => <option key={item}>{item}</option>)}</select></label> : null}
                <button className="secondary-button" type="submit">Search</button>
              </form>
            </div>
            {!rows.length ? <div className="empty-state">No projects match this moderation filter.</div> : (
              <div className="admin-record-list">
                {rows.map((project) => (
                  <article className="admin-record" key={project.id}>
                    {project.screenshotUrl ? <img className="admin-project-image" src={project.screenshotUrl} alt={`${project.title} project preview`} loading="lazy" /> : null}
                    <div className="admin-record-main">
                      <div className="dashboard-project-title"><h3>{project.title}</h3><span className={`status-badge status-${project.status}`}>{project.status.replaceAll('_', ' ')}</span></div>
                      <p>{project.tagline}</p>
                      <small>{project.ownerName} · {project.ownerEmail} · {project.category} · {project.reviewCount} reviews</small>
                      {project.summary ? <p><strong>Summary:</strong> {project.summary}</p> : null}
                      <p>{project.overview}</p>
                      <div className="tech-stack">
                        {(Array.isArray(project.techStack) ? project.techStack : []).map((technology) => <span key={technology}>{technology}</span>)}
                      </div>
                      <div className="project-links">
                        {project.repoUrl ? <a href={project.repoUrl} target="_blank" rel="noreferrer">Repository</a> : null}
                        {project.liveUrl ? <a href={project.liveUrl} target="_blank" rel="noreferrer">Live project</a> : null}
                      </div>
                      {project.status !== 'removed' ? (
                        <label className="admin-feedback-field">Feedback for the owner (required when rejecting, requesting changes, or removing)
                          <textarea rows={3} maxLength={5000} value={feedback[project.id] || ''} onChange={(event) => setFeedback((current) => ({ ...current, [project.id]: event.target.value }))} />
                        </label>
                      ) : null}
                      <div className="dashboard-project-actions">
                        {['pending', 'changes_requested', 'rejected'].includes(project.status) ? (
                          <>
                            <button className="primary-button" disabled={busyId === project.id} onClick={() => moderate(project, 'approve')}>Approve</button>
                            <button className="secondary-button" disabled={busyId === project.id} onClick={() => moderate(project, 'request_changes')}>Request changes</button>
                            <button className="secondary-button" disabled={busyId === project.id} onClick={() => moderate(project, 'reject')}>Reject</button>
                          </>
                        ) : null}
                        {project.status !== 'removed' ? <button className="secondary-button" disabled={busyId === project.id} onClick={() => moderate(project, 'remove')}>Remove</button> : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {total > 25 ? <div className="pagination-controls"><button className="secondary-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 25)}</span><button className="secondary-button" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((current) => current + 1)}>Next</button></div> : null}
          </section>
        ) : null}

        {!loading && view === 'users' ? (
          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <h2>Users</h2>
              <form className="dashboard-filters" onSubmit={applyFilters}>
                <label><span className="visually-hidden">Search users</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" /></label>
                <button className="secondary-button" type="submit">Search</button>
              </form>
            </div>
            {!rows.length ? <div className="empty-state">No users found.</div> : (
              <div className="admin-record-list">
                {rows.map((user) => <article className="admin-record admin-user-row" key={user.id}><strong>{user.name}</strong><span>{user.email}</span><span>{user.role}</span><span>{user.projectCount} projects</span></article>)}
              </div>
            )}
            {total > 25 ? <div className="pagination-controls"><button className="secondary-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 25)}</span><button className="secondary-button" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((current) => current + 1)}>Next</button></div> : null}
          </section>
        ) : null}

        {!loading && view === 'reviews' ? (
          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <h2>Ratings &amp; reviews</h2>
              <form className="dashboard-filters" onSubmit={applyFilters}>
                <label><span className="visually-hidden">Search reviews</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Project, reviewer, or review" /></label>
                <button className="secondary-button" type="submit">Search</button>
              </form>
            </div>
            {!rows.length ? <div className="empty-state">No reviews found.</div> : (
              <ul className="activity-list">
                {rows.map((review) => (
                  <li key={review.id}>
                    <div><strong>{review.projectTitle}</strong><span>{review.reviewerName} · {review.reviewerEmail} · {'★'.repeat(review.rating)} ({review.rating}/5)</span></div>
                    <p>{review.comment}</p>
                    <time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleString()}</time>
                  </li>
                ))}
              </ul>
            )}
            {total > 25 ? <div className="pagination-controls"><button className="secondary-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 25)}</span><button className="secondary-button" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((current) => current + 1)}>Next</button></div> : null}
          </section>
        ) : null}

        {!loading && view === 'history' ? (
          <section className="dashboard-section">
            <h2>Moderation history</h2>
            {!rows.length ? <div className="empty-state">No moderation actions have been recorded.</div> : (
              <ul className="activity-list">
                {rows.map((entry) => <li key={entry.id}><div><strong>{entry.projectTitle}</strong><span>{entry.action.replaceAll('_', ' ')} by {entry.adminName}</span></div><p>{entry.previousStatus} → {entry.resultingStatus}{entry.feedback ? ` · ${entry.feedback}` : ''}</p><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time></li>)}
              </ul>
            )}
            {total > 25 ? <div className="pagination-controls"><button className="secondary-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 25)}</span><button className="secondary-button" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((current) => current + 1)}>Next</button></div> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
