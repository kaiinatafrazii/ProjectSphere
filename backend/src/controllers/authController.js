import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { findUserByEmail, createUser } from '../repositories/userRepository.js';
import {
  buildUserView,
  clearSessionCookie,
  createSession,
  generateId,
  hashPassword,
  isSessionActive,
  readSessionCookie,
  revokeSession,
  setSessionCookie,
  signToken,
  verifyPassword,
  verifyToken,
} from '../services/authService.js';
import { findUserById } from '../repositories/userRepository.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { pool } from '../config/db.js';
import { sendEmail } from '../services/emailService.js';

export async function register(req, res) {
  try {
    const { name, email, password, bio, location, skills } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (!normalizedName || !normalizedEmail || !password) {
      return sendError(res, 400, 'Name, email, and password are required.');
    }
    if (normalizedName.length > 100) {
      return sendError(res, 400, 'Name must be 100 characters or fewer.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return sendError(res, 400, 'Enter a valid email address.');
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      return sendError(res, 400, 'Password must be between 8 and 72 characters.');
    }

    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return sendError(res, 409, 'An account with this email already exists.');
    }

    const passwordHash = await hashPassword(password);
    const id = generateId();
    const safeSkills = Array.isArray(skills) ? skills.slice(0, 20).filter((skill) => typeof skill === 'string').map((skill) => skill.slice(0, 40)) : [];

    await createUser({
      id,
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
      bio: typeof bio === 'string' ? bio.slice(0, 1000) : '',
      avatarUrl: null,
      location: typeof location === 'string' ? location.slice(0, 100) : '',
      skills: safeSkills,
      role: 'student',
    });

    const user = {
      id,
      name: normalizedName,
      email: normalizedEmail,
      bio: typeof bio === 'string' ? bio.slice(0, 1000) : '',
      location: typeof location === 'string' ? location.slice(0, 100) : '',
      skills: safeSkills,
      role: 'student',
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      savedProjects: [],
    };

    const sessionId = await createSession(id);
    setSessionCookie(res, signToken(user, sessionId));
    return sendSuccess(res, { user: buildUserView(user) }, 201);
  } catch (error) {
    console.error('Registration failed:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return sendError(res, 409, 'An account with this email already exists.');
    }
    return sendError(res, 500, 'Unable to create account right now.');
  }
}

const passwordResetRequestMessage = 'If an active account matches that email, password reset instructions will be sent.';

export async function requestPasswordReset(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  try {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const user = await findUserByEmail(email);
      if (user && (user.account_status || 'active') === 'active') {
        const token = randomBytes(32).toString('base64url');
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.execute(
            'UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND consumed_at IS NULL',
            [user.id]
          );
          await connection.execute(
            'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
            [generateId(), user.id, tokenHash, new Date(Date.now() + 30 * 60 * 1000).toISOString()]
          );
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = new URL('/reset-password', frontendUrl);
        resetUrl.searchParams.set('token', token);
        try {
          const delivered = await sendEmail({
            to: user.email,
            subject: 'Reset your ProjectSphere password',
            text: `Use this link within 30 minutes to reset your password: ${resetUrl.toString()}`,
            html: `<p>Use this link within 30 minutes to reset your ProjectSphere password:</p><p><a href="${resetUrl.toString()}">Reset password</a></p>`,
          });
          if (!delivered) {
            await pool.execute(
              'UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE token_hash = ?',
              [tokenHash]
            );
          }
        } catch {
          await pool.execute(
            'UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE token_hash = ?',
            [tokenHash]
          );
          console.error('Password reset email delivery failed.');
        }
      }
    }
  } catch (error) {
    console.error('Password reset request failed:', error);
  }
  return sendSuccess(res, { message: passwordResetRequestMessage }, 202);
}

export async function resetPassword(req, res) {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!token || token.length > 128 || password.length < 12 || password.length > 72) {
    return sendError(res, 400, 'Use a valid reset link and a password between 12 and 72 characters.');
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const passwordHash = await hashPassword(password);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT t.id, t.user_id AS userId FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.consumed_at IS NULL
         AND datetime(t.expires_at) > CURRENT_TIMESTAMP
         AND u.account_status = 'active'`,
      [tokenHash]
    );
    if (!rows.length) {
      await connection.rollback();
      return sendError(res, 400, 'This reset link is invalid or expired. Request a new one.');
    }
    const { id: tokenId, userId } = rows[0];
    await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    await connection.execute('UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?', [tokenId]);
    await connection.execute(
      'UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id <> ? AND consumed_at IS NULL',
      [userId, tokenId]
    );
    await connection.execute(
      'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
      [userId]
    );
    await connection.commit();
    return sendSuccess(res, { message: 'Password updated. Sign in with your new password.' });
  } catch (error) {
    await connection.rollback();
    console.error('Password reset failed:', error);
    return sendError(res, 500, 'Unable to reset password right now.');
  } finally {
    connection.release();
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return sendError(res, 400, 'Email and password are required.');
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return sendError(res, 401, 'Invalid credentials.');
    }

    const validPassword = await verifyPassword(password, user.password_hash || user.passwordHash);
    if (!validPassword) {
      return sendError(res, 401, 'Invalid credentials.');
    }
    if (user.account_status !== 'active') {
      return sendError(res, 403, 'This account is currently suspended. Contact the ProjectSphere team for assistance.');
    }

    const safeUser = buildUserView(user);
    const sessionId = await createSession(user.id);
    setSessionCookie(res, signToken(safeUser, sessionId));
    return sendSuccess(res, { user: safeUser });
  } catch (error) {
    console.error('Login failed:', error);
    return sendError(res, 500, 'Unable to log in right now.');
  }
}

export async function restoreSession(req, res) {
  const token = readSessionCookie(req);
  if (!token) return sendSuccess(res, { user: null });

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    if (error.name !== 'TokenExpiredError' && error.name !== 'JsonWebTokenError' && error.name !== 'NotBeforeError') {
      console.error('Session token verification failed:', error);
      return sendError(res, 500, 'Unable to restore session right now.');
    }
    clearSessionCookie(res);
    return sendSuccess(res, { user: null });
  }

  try {
    if (!(await isSessionActive(decoded.sid, decoded.id))) {
      clearSessionCookie(res);
      return sendSuccess(res, { user: null });
    }
    const user = await findUserById(decoded.id);
    if (!user) {
      clearSessionCookie(res);
      return sendSuccess(res, { user: null });
    }
    return sendSuccess(res, { user: buildUserView(user) });
  } catch (error) {
    console.error('Unable to restore session:', error);
    return sendError(res, 500, 'Unable to restore session right now.');
  }
}

export async function logout(req, res) {
  try {
    const token = readSessionCookie(req);
    if (token) {
      try {
        const decoded = verifyToken(token);
        await revokeSession(decoded.sid);
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          const decoded = jwt.decode(token);
          await revokeSession(decoded?.sid);
        } else if (error.name !== 'JsonWebTokenError' && error.name !== 'NotBeforeError') {
          throw error;
        }
      }
    }
    clearSessionCookie(res);
    return sendSuccess(res, { message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout failed:', error);
    return sendError(res, 500, 'Unable to end your session. Please try again.');
  }
}
