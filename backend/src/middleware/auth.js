import { sendError } from '../utils/response.js';
import { isSessionActive, readSessionCookie, verifyToken } from '../services/authService.js';

export async function requireAuth(req, res, next) {
  const token = readSessionCookie(req);

  if (!token) {
    return sendError(res, 401, 'Authentication required.');
  }

  try {
    const decoded = verifyToken(token);
    if (!(await isSessionActive(decoded.sid, decoded.id))) {
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
  } catch (error) {
    res.clearCookie('projectsphere_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.AUTH_COOKIE_SAME_SITE || 'lax',
      path: '/',
    });
    return sendError(res, 401, 'Invalid or expired session.');
  }
}
