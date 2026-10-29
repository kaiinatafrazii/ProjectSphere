import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiRequest, downloadRequest } from '../services/api.js';

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
  const [userRole, setUserRole] = useState('');
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');
  const [userSort, setUserSort] = useState('newest');
  const [selectedUser, setSelectedUser] = useState('');
  const [userDetails, setUserDetails] = useState(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectDetails, setProjectDetails] = useState(null);
  const [projectDetailsLoading, setProjectDetailsLoading] = useState(false);
  const [downloadingSource, setDownloadingSource] = useState(false);
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
        } else if (['users', 'reviews'].includes(view)) {
          if (search.trim()) params.set('search', search.trim());
          if (view === 'users') {
            if (userRole) params.set('role', userRole);
            if (createdAfter) params.set('createdAfter', createdAfter);
            if (createdBefore) params.set('createdBefore', createdBefore);
            params.set('sort', userSort);
          }
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

  const openUserDetails = async (id) => {
    setSelectedUser(id);
    setUserDetails(null);
    setUserDetailsLoading(true);
    setError('');
    try {
      const result = await apiRequest(`/admin/users/${encodeURIComponent(id)}`);
      setUserDetails(result);
    } catch (detailError) {
      setError(detailError.message || 'Unable to load this user.');
      setSelectedUser('');
    } finally {
      setUserDetailsLoading(false);
    }
  };

  const openProjectDetails = async (id) => {
    if (selectedProject === id) {
      setSelectedProject('');
      setProjectDetails(null);
      return;
    }
    setSelectedProject(id);
    setProjectDetails(null);
    setProjectDetailsLoading(true);
    setError('');
    try {
      const result = await apiRequest(`/admin/projects/${encodeURIComponent(id)}`);
      setProjectDetails(result.project);
    } catch (detailError) {
      setError(detailError.message || 'Unable to load project details.');
      setSelectedProject('');
    } finally {
      setProjectDetailsLoading(false);
    }
  };

  const downloadSource = async (project) => {
    setDownloadingSource(true);
    setError('');
    try {
      await downloadRequest(`/admin/projects/${encodeURIComponent(project.id)}/source-code/download`);
    } catch (downloadError) {
      setError(downloadError.message || 'Unable to download the private source archive.');
    } finally {
      setDownloadingSource(false);
    }
  };

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
              <article><span>Average rating</span><strong>{stats.averageRating ?? '—'}</strong></article>
              <article><span>Unread contact</span><strong>{stats.unreadContactMessages}</strong></article>
            </section>
            <div className="admin-recent-grid">
              <section className="dashboard-section">
                <h2>Pending review queue</h2>
                {!overview.pendingProjects?.length ? <div className="empty-state">No projects are waiting for review.</div> : (
                  <ul className="activity-list">
                    {overview.pendingProjects.map((project) => <li key={project.id}><div><strong>{project.title}</strong><span>{project.ownerName} · Submitted {new Date(project.createdAt).toLocaleDateString()}</span></div></li>)}
                  </ul>
                )}
              </section>
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
              <section className="dashboard-section">
                <h2>Recent reviews</h2>
                {!overview.recentReviews?.length ? <div className="empty-state">No reviews have been submitted.</div> : (
                  <ul className="activity-list">
                    {overview.recentReviews.map((review) => <li key={review.id}><div><strong>{review.projectTitle} · {'★'.repeat(review.rating)}</strong><span>{review.reviewerName} · {new Date(review.createdAt).toLocaleDateString()}</span></div><p>{review.comment}</p></li>)}
                  </ul>
                )}
              </section>
              <section className="dashboard-section">
                <h2>Recent moderation</h2>
                {!overview.recentActivity?.length ? <div className="empty-state">No moderation activity yet.</div> : (
                  <ul className="activity-list">
                    {overview.recentActivity.map((entry) => <li key={entry.id}><div><strong>{entry.projectTitle}</strong><span>{entry.action.replaceAll('_', ' ')} by {entry.adminName}</span></div>{entry.feedback ? <p>{entry.feedback}</p> : null}</li>)}
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
                        {project.repoUrl ? <a href={project.repoUrl} target="_blank" rel="noreferrer">Public repository</a> : null}
                        {project.liveUrl ? <a href={project.liveUrl} target="_blank" rel="noreferrer">Live project</a> : null}
                      </div>
                      <div className="dashboard-project-actions">
                        <button className="secondary-button" type="button" onClick={() => openProjectDetails(project.id)}>
                          {selectedProject === project.id ? 'Hide admin details' : 'Admin details and source'}
                        </button>
                      </div>
                      {selectedProject === project.id ? (
                        <section className="admin-project-private-details">
                          {projectDetailsLoading ? <p role="status">Loading project details…</p> : null}
                          {projectDetails ? (
                            <>
                              <h4>Project and owner</h4>
                              <p>{projectDetails.ownerName} · {projectDetails.ownerEmail}</p>
                              <p>Submitted {new Date(projectDetails.createdAt).toLocaleString()} · Status: {projectDetails.status} · Rating: {projectDetails.ratingAverage ?? '—'} ({projectDetails.reviewCount} reviews)</p>
                              <p><strong>Summary:</strong> {projectDetails.summary}</p>
                              <p>{projectDetails.overview}</p>
                              {projectDetails.screenshotUrl ? <img className="admin-project-image" src={projectDetails.screenshotUrl} alt={`${projectDetails.title} screenshot`} loading="lazy" /> : <p>No screenshot submitted.</p>}
                              <div className="project-links">
                                {projectDetails.repoUrl ? <a href={projectDetails.repoUrl} target="_blank" rel="noreferrer">Public repository</a> : <span>No public repository link</span>}
                                {projectDetails.liveUrl ? <a href={projectDetails.liveUrl} target="_blank" rel="noreferrer">Public live demo</a> : <span>No public live-demo link</span>}
                              </div>
                              <h4>Private source-code archive</h4>
                              {projectDetails.sourceCode ? (
                                <div>
                                  <p>{projectDetails.sourceCode.originalFilename} · {Math.ceil(projectDetails.sourceCode.sizeBytes / 1024)} KB · submitted {new Date(projectDetails.sourceCode.submittedAt).toLocaleString()}</p>
                                  <button className="secondary-button" type="button" disabled={downloadingSource} onClick={() => downloadSource(project)}>
                                    {downloadingSource ? 'Preparing download…' : 'Download private ZIP'}
                                  </button>
                                </div>
                              ) : <p>Source code not submitted.</p>}
                              <h4>Reviews and ratings</h4>
                              {!projectDetails.reviews.length ? <p>No reviews submitted.</p> : <ul className="activity-list">{projectDetails.reviews.map((review) => <li key={review.id}><div><strong>{review.reviewerName} · {'★'.repeat(review.rating)}</strong><span>{review.reviewerEmail} · {new Date(review.createdAt).toLocaleDateString()}</span></div><p>{review.comment}</p></li>)}</ul>}
                              <h4>Moderation history</h4>
                              {!projectDetails.history.length ? <p>No moderation actions recorded.</p> : <ul className="activity-list">{projectDetails.history.map((entry, index) => <li key={`${entry.createdAt}-${index}`}><div><strong>{entry.action.replaceAll('_', ' ')}</strong><span>{entry.adminName} · {new Date(entry.createdAt).toLocaleString()}</span></div><p>{entry.previousStatus} → {entry.resultingStatus}{entry.feedback ? ` · ${entry.feedback}` : ''}</p></li>)}</ul>}
                            </>
                          ) : null}
                        </section>
                      ) : null}
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
                <label><span className="visually-hidden">Filter by role</span><select value={userRole} onChange={(event) => setUserRole(event.target.value)}><option value="">All roles</option>{['student', 'developer', 'researcher', 'team', 'admin'].map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
                <label><span className="visually-hidden">Created after</span><input aria-label="Created after" type="date" value={createdAfter} onChange={(event) => setCreatedAfter(event.target.value)} /></label>
                <label><span className="visually-hidden">Created before</span><input aria-label="Created before" type="date" value={createdBefore} onChange={(event) => setCreatedBefore(event.target.value)} /></label>
                <label><span className="visually-hidden">Sort users</span><select value={userSort} onChange={(event) => setUserSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
                <button className="secondary-button" type="submit">Search</button>
              </form>
            </div>
            {!rows.length ? <div className="empty-state">No users found.</div> : (
              <div className="admin-record-list">
                {rows.map((user) => (
                  <article className="admin-record admin-user-row" key={user.id}>
                    <div className="admin-record-main"><strong>{user.name}</strong><span>{user.email}</span><span>{user.role} · joined {new Date(user.createdAt).toLocaleDateString()}</span><span>{user.projectCount} projects ({user.pendingProjectCount} pending) · {user.reviewCount} reviews</span></div>
                    <button className="secondary-button" type="button" onClick={() => openUserDetails(user.id)}>View details</button>
                  </article>
                ))}
              </div>
            )}
            {selectedUser ? (
              <section className="dashboard-section admin-user-detail" aria-live="polite">
                <div className="dashboard-section-heading"><h3>User details</h3><button className="secondary-button" type="button" onClick={() => { setSelectedUser(''); setUserDetails(null); }}>Close</button></div>
                {userDetailsLoading ? <p role="status">Loading user details…</p> : null}
                {userDetails ? (
                  <>
                    <p><strong>{userDetails.user.name}</strong> · {userDetails.user.email} · {userDetails.user.role}{userDetails.user.location ? ` · ${userDetails.user.location}` : ''}</p>
                    {userDetails.user.bio ? <p>{userDetails.user.bio}</p> : null}
                    <div className="dashboard-stats"><article><span>Projects</span><strong>{userDetails.stats.totalProjects}</strong></article><article><span>Approved</span><strong>{userDetails.stats.approvedProjects}</strong></article><article><span>Pending</span><strong>{userDetails.stats.pendingProjects}</strong></article><article><span>Rejected</span><strong>{userDetails.stats.rejectedProjects}</strong></article><article><span>Reviews written</span><strong>{userDetails.stats.reviewsWritten}</strong></article></div>
                    <h4>Projects</h4>
                    {!userDetails.projects.length ? <p>No projects.</p> : <ul className="activity-list">{userDetails.projects.map((project) => <li key={project.id}><div><strong>{project.title}</strong><span>{project.status} · {new Date(project.createdAt).toLocaleDateString()}</span></div>{project.moderationFeedback ? <p>Latest admin feedback: {project.moderationFeedback}</p> : null}</li>)}</ul>}
                    <h4>Reviews submitted</h4>
                    {!userDetails.reviews.length ? <p>No reviews.</p> : <ul className="activity-list">{userDetails.reviews.map((review) => <li key={review.id}><div><strong>{review.projectTitle} · {'★'.repeat(review.rating)}</strong><span>{new Date(review.createdAt).toLocaleDateString()}</span></div><p>{review.comment}</p></li>)}</ul>}
                  </>
                ) : null}
              </section>
            ) : null}
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
