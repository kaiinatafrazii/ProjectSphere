import { useEffect, useState } from 'react';
import { apiRequest } from '../services/api.js';

const metricLabels = [
  ['users', 'New users', 'chart-bar-users'],
  ['submissions', 'Submissions', 'chart-bar-submissions'],
  ['approvals', 'Approvals', 'chart-bar-approvals'],
];

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/admin/analytics')
      .then((response) => {
        if (active) setAnalytics(response);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load platform analytics.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="page-shell center-block"><div className="empty-state" role="status">Loading analytics…</div></div>;
  if (error || !analytics) return <div className="page-shell center-block"><div className="empty-state" role="alert">{error || 'Analytics are unavailable.'}</div></div>;

  const monthly = analytics.monthly || [];
  const monthlyMax = Math.max(1, ...monthly.flatMap((item) => metricLabels.map(([key]) => Number(item[key]) || 0)));
  const categories = analytics.categories || [];
  const categoryMax = Math.max(1, ...categories.map((item) => Number(item.count) || 0));

  return (
    <div className="page-shell dashboard-page admin-analytics-page">
      <div className="container">
        <section className="dashboard-stats" aria-label="Current platform totals">
          <article><span>Total users</span><strong>{analytics.summary.totalUsers}</strong></article>
          <article><span>Total projects</span><strong>{analytics.summary.totalProjects}</strong></article>
          <article><span>Pending projects</span><strong>{analytics.summary.pendingProjects}</strong></article>
          <article><span>Published projects</span><strong>{analytics.summary.publishedProjects}</strong></article>
          <article><span>Reviews</span><strong>{analytics.summary.totalReviews}</strong></article>
        </section>

        <section className="dashboard-section analytics-section" aria-labelledby="activity-chart-title">
          <div className="dashboard-section-heading">
            <div>
              <h2 id="activity-chart-title">Platform activity</h2>
              <p>Monthly totals for the latest 12 months</p>
            </div>
            <div className="analytics-legend">
              {metricLabels.map(([, label, className]) => <span key={label}><i className={className} />{label}</span>)}
            </div>
          </div>
          {!monthly.length ? <div className="empty-state">No monthly activity data is available.</div> : (
            <div className="analytics-chart" role="img" aria-label="Monthly registrations, project submissions, and approvals">
              {monthly.map((month) => (
                <div className="analytics-month" key={month.month}>
                  <div className="analytics-bars">
                    {metricLabels.map(([key, label, className]) => {
                      const value = Number(month[key]) || 0;
                      return <span key={key} className={className} style={{ height: `${value ? Math.max(4, value / monthlyMax * 100) : 0}%` }} title={`${label}: ${value}`} />;
                    })}
                  </div>
                  <span className="analytics-month-values">{month.users}/{month.submissions}/{month.approvals}</span>
                  <time dateTime={`${month.month}-01`}>{month.label}</time>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section analytics-section" aria-labelledby="category-chart-title">
          <div className="dashboard-section-heading">
            <div>
              <h2 id="category-chart-title">Published projects by category</h2>
              <p>Counts include published and featured projects.</p>
            </div>
          </div>
          {!categories.length ? <div className="empty-state">No published projects to chart yet.</div> : (
            <ul className="category-chart">
              {categories.map((item) => (
                <li key={item.category}>
                  <span>{item.category}</span>
                  <div className="category-bar-track" aria-hidden="true"><i style={{ width: `${Number(item.count) / categoryMax * 100}%` }} /></div>
                  <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}