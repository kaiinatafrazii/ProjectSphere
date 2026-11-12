import { pool } from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';

export async function listUserNotifications(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const offset = (page - 1) * limit;
  const unreadOnly = req.query.unread === 'true';
  const where = unreadOnly ? 'AND read_at IS NULL' : '';

  try {
    const [rows] = await pool.execute(
      `SELECT id, type, title, message, entity_type AS entityType, entity_id AS entityId,
        read_at AS readAt, created_at AS createdAt
       FROM user_notifications WHERE user_id = ? ${where}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM user_notifications WHERE user_id = ? ${where}`,
      [req.user.id]
    );
    const [unreadRows] = await pool.execute(
      'SELECT COUNT(*) AS unreadCount FROM user_notifications WHERE user_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    return sendSuccess(res, {
      notifications: rows,
      page,
      limit,
      total: Number(countRows[0].total),
      unreadCount: Number(unreadRows[0].unreadCount),
    });
  } catch (error) {
    console.error('Notification listing failed:', error);
    return sendError(res, 500, 'Unable to load notifications.');
  }
}

export async function updateNotificationReadState(req, res) {
  if (typeof req.body?.isRead !== 'boolean') {
    return sendError(res, 400, 'isRead must be true or false.');
  }
  try {
    const [result] = await pool.execute(
      'UPDATE user_notifications SET read_at = CASE WHEN ? THEN COALESCE(read_at, CURRENT_TIMESTAMP) ELSE NULL END WHERE id = ? AND user_id = ?',
      [req.body.isRead ? 1 : 0, req.params.id, req.user.id]
    );
    if (!result.affectedRows) return sendError(res, 404, 'Notification not found.');
    return sendSuccess(res, { message: 'Notification updated.' });
  } catch (error) {
    console.error('Notification update failed:', error);
    return sendError(res, 500, 'Unable to update notification.');
  }
}

export async function markAllNotificationsRead(req, res) {
  try {
    const [result] = await pool.execute(
      'UPDATE user_notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    return sendSuccess(res, { updated: Number(result.affectedRows) });
  } catch (error) {
    console.error('Bulk notification update failed:', error);
    return sendError(res, 500, 'Unable to update notifications.');
  }
}