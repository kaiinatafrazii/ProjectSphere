import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../services/api.js';

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (unreadOnly) params.set('unread', 'true');
      const result = await apiRequest(`/admin/contact-messages?${params}`);
      setMessages(result.messages || []);
      setTotal(result.total || 0);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load contact messages.');
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const toggleRead = async (message) => {
    setBusyId(message.id);
    setError('');
    try {
      await apiRequest(`/admin/contact-messages/${encodeURIComponent(message.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isRead: !message.isRead }),
      });
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, isRead: !message.isRead } : item));
      setTotal((current) => Math.max(0, current - (unreadOnly && !message.isRead ? 1 : 0)));
    } catch (updateError) {
      setError(updateError.message || 'Unable to update the contact message.');
    } finally {
      setBusyId('');
    }
  };

  const changeFilter = (event) => {
    setUnreadOnly(event.target.checked);
    setPage(1);
  };

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-heading">
        <div>
          <h2>Contact messages</h2>
          <p>Messages submitted through the public contact form.</p>
        </div>
        <label className="admin-filter-check"><input type="checkbox" checked={unreadOnly} onChange={changeFilter} /> Unread only</label>
      </div>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {loading ? <div className="empty-state" role="status">Loading contact messages…</div> : null}
      {!loading && !messages.length ? <div className="empty-state">No contact messages found.</div> : null}
      {!loading && messages.length ? (
        <div className="admin-record-list">
          {messages.map((message) => (
            <article className={`admin-record${message.isRead ? '' : ' is-unread'}`} key={message.id}>
              <div className="admin-record-main">
                <div className="dashboard-project-title"><h3>{message.subject}</h3>{!message.isRead ? <span className="status-badge status-pending">Unread</span> : null}</div>
                <p>{message.message}</p>
                <small>{message.name} · <a href={`mailto:${encodeURIComponent(message.email)}`}>{message.email}</a> · {new Date(message.createdAt).toLocaleString()}</small>
              </div>
              <button className="secondary-button" type="button" disabled={busyId === message.id} onClick={() => toggleRead(message)}>
                {busyId === message.id ? 'Saving…' : message.isRead ? 'Mark unread' : 'Mark read'}
              </button>
            </article>
          ))}
        </div>
      ) : null}
      {total > 25 ? <div className="pagination-controls"><button className="secondary-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 25)}</span><button className="secondary-button" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((current) => current + 1)}>Next</button></div> : null}
    </section>
  );
}
