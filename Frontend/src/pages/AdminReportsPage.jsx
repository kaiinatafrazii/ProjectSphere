import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/api.js';

const PAGE_SIZE = 25;

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('open');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [resolution, setResolution] = useState({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ status, page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set('search', search);
    apiRequest(`/admin/reports?${params}`)
      .then((response) => {
        if (!active) return;
        setReports(response.reports || []);
        setTotal(response.total || 0);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load project reports.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [status, search, page]);

  const applySearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const updateReport = async (report, nextStatus) => {
    const note = (resolution[report.id] || '').trim();
    if (!note) {
      setError('Add a resolution note before closing this report.');
      return;
    }
    setBusyId(report.id);
    setError('');
    setNotice('');
    try {
      const response = await apiRequest(`/admin/reports/${encodeURIComponent(report.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, resolution: note }),
      });
      setReports((current) => current.filter((item) => item.id !== report.id));
      setTotal((current) => Math.max(0, current - 1));
      setNotice(response.message || 'Report updated.');
    } catch (updateError) {
      setError(updateError.message || 'Unable to update project report.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="page-shell dashboard-page">
      <div className="container">
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        {notice ? <p className="success-text" role="status">{notice}</p> : null}
        <section className="dashboard-section" aria-labelledby="reports-heading">
          <div className="dashboard-section-heading">
            <div>
              <h2 id="reports-heading">Project reports</h2>
              <p>{total} reports</p>
            </div>
            <div className="admin-report-filters">
              <label>
                <span>Status</span>
                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </label>
              <form className="dashboard-filters" onSubmit={applySearch}>
                <label><span className="visually-hidden">Search reports</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>
                <button className="secondary-button" type="submit">Search</button>
              </form>
            </div>
          </div>
          {loading ? <div className="empty-state" role="status">Loading project reports…</div> : null}
          {!loading && !reports.length ? <div className="empty-state">No {status} project reports found.</div> : null}
          {!loading && reports.length ? (
            <div className="admin-record-list">
              {reports.map((report) => (
                <article className="admin-record report-record" key={report.id}>
                  <div className="admin-record-main">
                    <div className="dashboard-project-title">
                      <h3>{report.projectTitle}</h3>
                      <span className={`status-badge ${report.status === 'open' ? 'status-pending' : 'status-published'}`}>{report.status}</span>
                    </div>
                    <p><strong>Reason:</strong> {report.reason}</p>
                    <p>{report.details || 'No additional details provided.'}</p>
                    <small>{report.reporterName} · <a href={`mailto:${encodeURIComponent(report.reporterEmail)}`}>{report.reporterEmail}</a> · {new Date(report.createdAt).toLocaleString()}</small>
                    <p><Link to={`/projects/${encodeURIComponent(report.projectId)}`} target="_blank" rel="noreferrer">Open reported project</Link></p>
                    {report.resolution ? <p><strong>Resolution:</strong> {report.resolution}</p> : null}
                    {report.status === 'open' ? (
                      <>
                        <label className="admin-feedback-field">
                          Resolution note
                          <textarea rows={3} maxLength={3000} value={resolution[report.id] || ''} onChange={(event) => setResolution((current) => ({ ...current, [report.id]: event.target.value }))} />
                        </label>
                        <div className="dashboard-project-actions">
                          <button type="button" className="primary-button" disabled={busyId === report.id} onClick={() => updateReport(report, 'resolved')}>{busyId === report.id ? 'Saving…' : 'Resolve'}</button>
                          <button type="button" className="secondary-button" disabled={busyId === report.id} onClick={() => updateReport(report, 'dismissed')}>{busyId === report.id ? 'Saving…' : 'Dismiss'}</button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {!loading && total > PAGE_SIZE ? (
            <div className="pagination-controls" aria-label="Report pages">
              <button type="button" className="secondary-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
              <span>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
              <button type="button" className="secondary-button" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((current) => current + 1)}>Next</button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}