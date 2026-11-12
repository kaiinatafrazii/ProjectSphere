import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import { optimizedImageUrl } from '../utils/imageUrl.js';

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: 'inappropriate', details: '' });
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const isTeacherOrAdmin = ['admin', 'teacher', 'researcher'].includes(user?.role);

  useEffect(() => {
    async function loadProject() {
      try {
        const response = await apiRequest(`/projects/${id}`);
        setProject(response.project);
      } catch (error) {
        setLoadError(error.message || 'Unable to load this project.');
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [id]);

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: `/projects/${id}` } });
      return;
    }

    setReviewError('');
    setReviewSuccess('');
    setSubmittingReview(true);
    try {
      await apiRequest(`/projects/${id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ ...reviewForm, comment: reviewForm.comment.trim() }),
      });
      setReviewForm({ rating: 5, comment: '' });
      setReviewSuccess('Your review has been published.');
      try {
        const response = await apiRequest(`/projects/${id}`);
        setProject(response.project);
      } catch {
        setReviewError('Your review was saved, but the latest review list could not be refreshed.');
      }
    } catch (error) {
      setReviewError(error.message || 'Unable to submit your review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitReport = async (event) => {
    event.preventDefault();
    setReportError('');
    setReportSuccess('');
    setSubmittingReport(true);
    try {
      const response = await apiRequest(`/projects/${encodeURIComponent(id)}/reports`, {
        method: 'POST',
        body: JSON.stringify(reportForm),
      });
      setReportSuccess(response.message || 'Your report was sent to the moderation team.');
      setReportForm({ reason: 'inappropriate', details: '' });
      setReportOpen(false);
    } catch (submitError) {
      setReportError(submitError.message || 'Unable to submit your report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) return <div className="page-shell center-block"><div className="empty-state">Loading project details...</div></div>;
  if (!project) return <div className="page-shell center-block"><div className="empty-state" role="alert">{loadError || 'Project not found.'}<p><Link to="/discover">Return to projects</Link></p></div></div>;
  const isOwner = user?.id && user.id === project.owner?.id;
  const canViewSourceCode = isOwner || isTeacherOrAdmin;
  const averageRating = project.ratingAverage === null || project.ratingAverage === undefined
    ? '—'
    : Number.isFinite(Number(project.ratingAverage)) ? Number(project.ratingAverage).toFixed(1) : '—';

  return (
    <div className="page-shell detail-page">
      <section className="project-hero">
        <div className="container project-hero-grid">
          <div>
            <span className="eyebrow">{project.category}</span>
            <h1>{project.title}</h1>
            <p className="project-tagline large">{project.tagline}</p>
            <div className="hero-actions compact">
              {project.liveUrl ? <a href={project.liveUrl} className="primary-button" target="_blank" rel="noreferrer">Presentation / demo</a> : null}
              {canViewSourceCode && project.repoUrl ? <a href={project.repoUrl} className="secondary-button" target="_blank" rel="noreferrer">Source code / repository</a> : null}
              {!canViewSourceCode ? <span className="restriction-badge">Source code is restricted to admin and teacher access.</span> : null}
            </div>
          </div>
          <div className="project-hero-media">
            {project.screenshotUrl ? <img src={optimizedImageUrl(project.screenshotUrl, 1200)} alt={`${project.title} project preview`} fetchpriority="high" decoding="async" /> : <div className="image-placeholder">Project preview unavailable</div>}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="container project-layout">
          <div className="project-content">
            <div className="card-panel">
              <h2>Project idea</h2>
              <p>{project.overview || project.summary}</p>
            </div>

            <div className="card-panel">
              <h2>Summary</h2>
              <p>{project.summary}</p>
            </div>

            <div className="card-panel">
              <h2>Tech stack</h2>
              <div className="tech-stack large-stack">
                {(project.techStack || []).map((tech) => (
                  <span key={tech}>{tech}</span>
                ))}
              </div>
            </div>

            <div className="card-panel">
              <h2>Reviews</h2>
              <p className="muted-copy">
                {project.reviewCount || 0} ratings
                {project.ratingAverage !== null && project.ratingAverage !== undefined ? ` · ${averageRating} average rating` : ''}
              </p>
              {project.reviews && project.reviews.length > 0 ? (
                <div className="review-list">
                  {project.reviews.map((review) => (
                    <div key={review.id} className="review-item">
                      <div className="review-header">
                        <strong>{review.userName || 'Anonymous reviewer'}</strong>
                        <span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                      </div>
                      <p>{review.comment}</p>
                      {review.createdAt ? <time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString()}</time> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-copy">No reviews yet. Be the first to share feedback.</p>
              )}
            </div>
          </div>

          <aside className="project-sidebar">
            <div className="card-panel sticky-panel">
              <div className="profile-mini">
                <img src={optimizedImageUrl(project.owner?.avatarUrl || '/favicon.svg', 120)} alt="" loading="lazy" decoding="async" />
                <div>
                  {project.owner ? <Link to={`/creators/${encodeURIComponent(project.owner.id)}`}><strong>{project.owner.name}</strong></Link> : <strong>Creator</strong>}
                  <p>{project.owner ? 'Project author' : 'Community creator'}</p>
                </div>
              </div>

              <dl className="stats-list">
                <div>
                  <dt>Average rating</dt>
                  <dd>{averageRating}</dd>
                </div>
              </dl>
            </div>

            {!isOwner ? <div className="card-panel">
              <h3>Leave feedback</h3>
              <form className="review-form" onSubmit={handleSubmitReview}>
                <label>
                  Rating
                  <select value={reviewForm.rating} onChange={(event) => setReviewForm({ ...reviewForm, rating: Number(event.target.value) })}>
                    <option value={5}>5 stars</option>
                    <option value={4}>4 stars</option>
                    <option value={3}>3 stars</option>
                    <option value={2}>2 stars</option>
                    <option value={1}>1 star</option>
                  </select>
                </label>
                <label>
                  Comment
                  <textarea value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} rows={4} maxLength={3000} placeholder="Share your feedback..." required />
                </label>
                {reviewError ? <p className="error-text" role="alert">{reviewError}</p> : null}
                {reviewSuccess ? <p className="success-text" role="status">{reviewSuccess}</p> : null}
                {user ? (
                  <button type="submit" className="primary-button full-width" disabled={submittingReview}>
                    {submittingReview ? 'Submitting…' : 'Submit review'}
                  </button>
                ) : (
                  <Link to="/login" state={{ from: `/projects/${id}` }} className="primary-button full-width">Log in to review</Link>
                )}
              </form>
            </div> : null}
            {!isOwner ? <div className="card-panel report-project-panel">
              <h3>Report project</h3>
              {reportError ? <p className="error-text" role="alert">{reportError}</p> : null}
              {reportSuccess ? <p className="success-text" role="status">{reportSuccess}</p> : null}
              {user ? (
                <>
                  <button type="button" className="secondary-button" aria-expanded={reportOpen} onClick={() => setReportOpen((open) => !open)}>
                    {reportOpen ? 'Cancel report' : 'Report this project'}
                  </button>
                  {reportOpen ? (
                    <form className="review-form report-form" onSubmit={handleSubmitReport}>
                      <label>
                        Reason
                        <select value={reportForm.reason} onChange={(event) => setReportForm((current) => ({ ...current, reason: event.target.value }))}>
                          <option value="spam">Spam</option>
                          <option value="inappropriate">Inappropriate content</option>
                          <option value="copyright">Copyright concern</option>
                          <option value="misleading">Misleading information</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label>
                        Details (optional)
                        <textarea value={reportForm.details} onChange={(event) => setReportForm((current) => ({ ...current, details: event.target.value }))} rows={3} maxLength={3000} />
                      </label>
                      <button type="submit" className="danger-button secondary-button" disabled={submittingReport}>
                        {submittingReport ? 'Sending…' : 'Send report'}
                      </button>
                    </form>
                  ) : null}
                </>
              ) : <Link to="/login" state={{ from: `/projects/${id}` }} className="secondary-button">Log in to report</Link>}
            </div> : null}
          </aside>
        </div>
      </section>
      {project.ownerProjects?.length ? (
        <section className="section-block">
          <div className="container">
            <div className="section-heading left-aligned">
              <span className="eyebrow">More from this creator</span>
              <h2>Other published projects</h2>
            </div>
            <div className="project-grid">
              {project.ownerProjects.map((item) => (
                <article className="project-card" key={item.id}>
                  <div className="project-card-image-wrap">{item.screenshotUrl ? <img className="project-card-image" src={optimizedImageUrl(item.screenshotUrl, 720)} alt={`${item.title} project preview`} loading="lazy" /> : <div className="image-placeholder card-image-placeholder">Preview unavailable</div>}</div>
                  <div className="project-card-content"><span className="pill">{item.category}</span><h3>{item.title}</h3><p className="project-tagline">{item.tagline}</p><Link className="link-button" to={`/projects/${encodeURIComponent(item.id)}`}>View project</Link></div>
                </article>
              ))}
            </div>
            {project.owner ? <Link className="secondary-button" to={`/creators/${encodeURIComponent(project.owner.id)}`}>View creator profile</Link> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
