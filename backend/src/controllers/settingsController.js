import { createHash, randomBytes } from 'node:crypto';
import { pool } from '../config/db.js';
import { findUserByEmail, findUserById } from '../repositories/userRepository.js';
import { generateId, hashPassword, verifyPassword } from '../services/authService.js';
import { sendEmail } from '../services/emailService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export async function getUserPreferences(req, res) {
  try {
    const [rows] = await pool.execute(
      'SELECT email_notifications AS emailNotifications, product_updates AS productUpdates FROM user_preferences WHERE user_id = ?',
      [req.user.id]
    );
    const preferences = rows[0] || { emailNotifications: 1, productUpdates: 1 };
    return sendSuccess(res, { preferences: {
      emailNotifications: Boolean(preferences.emailNotifications),
      productUpdates: Boolean(preferences.productUpdates),
    } });
  } catch (error) {
    console.error('Preference retrieval failed:', error);
    return sendError(res, 500, 'Unable to load account preferences.');
  }
}

export async function updateUserPreferences(req, res) {
  const { emailNotifications, productUpdates } = req.body || {};
  if (typeof emailNotifications !== 'boolean' || typeof productUpdates !== 'boolean') {
    return sendError(res, 400, 'Choose a value for each account preference.');
  }
  try {
    await pool.execute(
      `INSERT INTO user_preferences (user_id, email_notifications, product_updates)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         email_notifications = VALUES(email_notifications),
         product_updates = VALUES(product_updates),
         updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, emailNotifications ? 1 : 0, productUpdates ? 1 : 0]
    );
    return sendSuccess(res, { preferences: { emailNotifications, productUpdates }, message: 'Preferences saved.' });
  } catch (error) {
    console.error('Preference update failed:', error);
    return sendError(res, 500, 'Unable to save account preferences.');
  }
}

export async function changeOwnPassword(req, res) {
  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return sendError(res, 400, 'Enter your current password and a new password.');
  }
  if (newPassword.length < 12 || newPassword.length > 72) {
    return sendError(res, 400, 'The new password must be between 12 and 72 characters.');
  }
  try {
    const user = await findUserById(req.user.id);
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return sendError(res, 401, 'Current password is incorrect.');
    }
    const passwordHash = await hashPassword(newPassword);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
      await connection.execute(
        'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id <> ? AND revoked_at IS NULL',
        [req.user.id, req.user.sid]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return sendSuccess(res, { message: 'Password changed. Other active sessions have been signed out.' });
  } catch (error) {
    console.error('User password update failed:', error);
    return sendError(res, 500, 'Unable to change your password.');
  }
}

export async function requestEmailChange(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const currentPassword = req.body?.currentPassword;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof currentPassword !== 'string') {
    return sendError(res, 400, 'Enter a valid new email address and your current password.');
  }
  try {
    const user = await findUserById(req.user.id);
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return sendError(res, 401, 'Current password is incorrect.');
    }
    if (email === String(user.email).toLowerCase()) return sendError(res, 400, 'That is already your account email.');
    if (await findUserByEmail(email)) return sendError(res, 409, 'That email address is already associated with an account.');

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await pool.execute(
      'UPDATE email_change_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND consumed_at IS NULL',
      [req.user.id]
    );
    await pool.execute(
      'INSERT INTO email_change_tokens (id, user_id, new_email, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
      [generateId(), req.user.id, email, tokenHash, new Date(Date.now() + 30 * 60 * 1000)]
    );

    const frontendOrigin = new URL(process.env.FRONTEND_URL || 'http://localhost:5173');
    if (process.env.NODE_ENV === 'production' && frontendOrigin.protocol !== 'https:') {
      throw new Error('Production email verification links must use HTTPS.');
    }
    const verifyUrl = new URL('/verify-email-change', frontendOrigin);
    verifyUrl.searchParams.set('token', token);
    const delivered = await sendEmail({
      to: email,
      subject: 'Confirm your ProjectSphere email change',
      text: `Use this link within 30 minutes to confirm your new email: ${verifyUrl.toString()}`,
      html: `<p>Use this link within 30 minutes to confirm your new email:</p><p><a href="${verifyUrl.toString()}">Confirm email change</a></p>`,
    });
    if (!delivered) {
      await pool.execute('UPDATE email_change_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE token_hash = ?', [tokenHash]);
    }
    return sendSuccess(res, { message: 'If email delivery is configured, a confirmation link has been sent to the new address.' }, 202);
  } catch (error) {
    console.error('Email change request failed:', error.message);
    return sendError(res, 500, 'Unable to request an email change.');
  }
}

export async function confirmEmailChange(req, res) {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!token || token.length > 128) return sendError(res, 400, 'Enter a valid email confirmation token.');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT t.id, t.user_id AS userId, t.new_email AS newEmail FROM email_change_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.consumed_at IS NULL
         AND t.expires_at > CURRENT_TIMESTAMP AND u.account_status = 'active'`,
      [tokenHash]
    );
    if (!rows.length) {
      await connection.rollback();
      return sendError(res, 400, 'This email confirmation link is invalid or expired.');
    }
    const { id, userId, newEmail } = rows[0];
    await connection.execute('UPDATE users SET email = ? WHERE id = ?', [newEmail, userId]);
    await connection.execute('UPDATE email_change_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    await connection.execute(
      'UPDATE email_change_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id <> ? AND consumed_at IS NULL',
      [userId, id]
    );
    await connection.execute(
      'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
      [userId]
    );
    await connection.commit();
    return sendSuccess(res, { message: 'Email updated. Sign in again with your new email address.' });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return sendError(res, 409, 'That email address is already associated with an account.');
    }
    console.error('Email change confirmation failed:', error);
    return sendError(res, 500, 'Unable to confirm the email change.');
  } finally {
    connection.release();
  }
}
