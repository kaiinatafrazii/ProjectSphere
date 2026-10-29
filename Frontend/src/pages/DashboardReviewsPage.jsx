import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/api.js';

export default function DashboardReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/projects/dashboard')
      .then((response) => {
        if (active) setReviews(response.recentReviews || []);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load your project reviews.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page-shell dashboard-page">
      <div className="container">
        <section className="dashboard-section" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading">Reviews on your projects</h2>
          {loading ? <div className="empty-state" role="status">Loading your reviews…</div> : null}
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          {!loading && !error && !reviews.length ? (
            <div className="empty-state">
              <strong>No project reviews yet.</strong>
              <p>Reviews left by the community on your published work will appear here.</p>
              <Link to="/dashboard/projects" className="secondary-button">View my projects</Link>
            </div>
          ) : null}
          {!loading && !error && reviews.length ? (
            <ul className="activity-list">
              {reviews.map((review) => (
                <li key={`${review.projectId}-${review.createdAt}`}>
                  <div><strong>{review.projectTitle}</strong><span>{review.reviewerName} · {'★'.repeat(review.rating)} ({review.rating}/5)</span></div>
                  {review.comment ? <p>{review.comment}</p> : null}
                  <time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString()}</time>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
