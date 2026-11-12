import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/api.js';

const PAGE_SIZE = 25;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest(`/users/me/notifications?page=${page}&limit=${PAGE_SIZE}`)
      .then((response) => {
        if (!active) return;
        setNotifications(response.notifications || []);
        setUnreadCount(response.unreadCount || 0);
        setTotal(response.total || 0);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load notifications.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page]);

  const updateReadState = async (notification, isRead) => {
    setBusyId(notification.id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/users/me/notifications/${encodeURIComponent(notification.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isRead }),
      });
      setNotifications((current) => current.map((item) => item.id === notification.id
        ? { ...item, readAt: isRead ? new Date().toISOString() : null }
        : item));
      setUnreadCount((current) => Math.max(0, current + (isRead ? -1 : 1)));
    } catch (updateError) {
      setError(updateError.message || 'Unable to update this notification.');
    } finally {
      setBusyId('');
    }
  };

  const markAllRead = async () => {
    setBusyId('all');
    setError('');
    setNotice('');
    try {
      await apiRequest('/users/me/notifications/read-all', { method: 'PATCH' });
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnreadCount(0);
      setNotice('All notifications marked as read.');
    } catch (updateError) {
      setError(updateError.message || 'Unable to update notifications.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="page-shell dashboard-page">
      <div className="container">
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        {notice ? <p className="success-text" role="status">{notice}</p> : null}
        <section className="dashboard-section notification-section" aria-labelledby="notifications-heading">
          <div className="dashboard-section-heading">
            <div>
              <h2 id="notifications-heading">Notifications</h2>
              <p>{unreadCount} unread</p>
            </div>
            <button type="button" className="secondary-button" onClick={markAllRead} disabled={!unreadCount || busyId === 'all'}>
              {busyId === 'all' ? 'Updating…' : 'Mark all read'}
            </button>
          </div>
          {loading ? <div className="empty-state" role="status">Loading notifications…</div> : null}
          {!loading && !notifications.length ? (
            <div className="empty-state">
              <strong>You’re all caught up.</strong>
              <p>Project updates and new reviews will appear here.</p>
              <Link to="/discover" className="secondary-button">Explore projects</Link>
            </div>
          ) : null}
          {!loading && notifications.length ? (
            <div className="notification-list">
              {notifications.map((notification) => (
                <article className={`notification-item${notification.readAt ? '' : ' is-unread'}`} key={notification.id}>
                  <div className="notification-copy">
                    <div className="notification-heading">
                      <h3>{notification.title}</h3>
                      <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
                    </div>
                    <p>{notification.message}</p>
                    {notification.entityType === 'project' && notification.entityId ? (
                      <Link to={`/projects/${encodeURIComponent(notification.entityId)}`} className="link-button">View project</Link>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busyId === notification.id}
                    onClick={() => updateReadState(notification, !notification.readAt)}
                  >
                    {busyId === notification.id ? 'Saving…' : notification.readAt ? 'Mark unread' : 'Mark read'}
                  </button>
                </article>
              ))}
            </div>
          ) : null}
          {!loading && total > PAGE_SIZE ? (
            <div className="pagination-controls" aria-label="Notification pages">
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