import { sendError } from '../utils/response.js';
import { isSessionActive, readSessionCookie, verifyToken } from '../services/authService.js';
import { pool } from '../config/db.js';

export async function requireAuth(req, res, next) {
  const token = readSessionCookie(req);

  if (!token) {
    return sendError(res, 401, 'Authentication required.');
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    res.clearCookie('projectsphere_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.AUTH_COOKIE_SAME_SITE || 'lax',
      path: '/',
    });
    return sendError(res, 401, 'Invalid or expired session.');
  }

  let active;
  try {
    active = await isSessionActive(decoded.sid, decoded.id);
  } catch (error) {
    return next(error);
  }

  if (!active) {
    res.clearCookie('projectsphere_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.AUTH_COOKIE_SAME_SITE || 'lax',
      path: '/',
    });
    return sendError(res, 401, 'Session is no longer active.');
  }

  req.user = decoded;
  return next();
}

export async function requireAdmin(req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (rows[0]?.role !== 'admin') {
      return sendError(res, 403, 'Administrator access required.');
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
