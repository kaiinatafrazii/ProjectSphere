import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { memoryStore, pool, query } from '../config/db.js';

const SESSION_COOKIE = 'projectsphere_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (
    process.env.NODE_ENV === 'production' &&
    (!secret || secret.length < 32 || /^(change-me|replace|dev-secret)/i.test(secret))
  ) {
    throw new Error('Set a unique JWT_SECRET of at least 32 characters in production.');
  }
  return secret || 'dev-secret';
}

export async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(user, sessionId) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'student',
      sid: sessionId,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export async function createSession(userId) {
  const id = generateId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await query(
    'INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    [id, userId, expiresAt]
  );
  return id;
}

export async function isSessionActive(sessionId, userId) {
  if (!sessionId) return false;
  const rows = await query(
    'SELECT * FROM auth_sessions WHERE id = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP',
    [sessionId]
  );
  const session = rows[0];
  return Boolean(
    session &&
    (session.user_id || session.userId) === userId &&
    (!session.expires_at || new Date(session.expires_at).getTime() > Date.now())
  );
}

export async function revokeSession(sessionId) {
  if (!sessionId) return;
  const demoSession = memoryStore.sessions.find((session) => session.id === sessionId);
  if (demoSession) {
    demoSession.revokedAt = new Date().toISOString();
    return;
  }
  const [result] = await pool.execute(
    'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL',
    [sessionId]
  );
  if (result.affectedRows !== 1) {
    throw new Error('The active session could not be revoked.');
  }
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.AUTH_COOKIE_SAME_SITE || 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.AUTH_COOKIE_SAME_SITE || 'lax',
    path: '/',
  });
}

export function readSessionCookie(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  return cookie ? cookie.slice(SESSION_COOKIE.length + 1) : null;
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export function buildUserView(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio || '',
    location: user.location || '',
    skills: typeof user.skills === 'string' ? JSON.parse(user.skills) : user.skills || [],
    role: user.role || 'student',
    avatarUrl: user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=500&q=80',
    savedProjects: user.savedProjects || [],
    createdAt: user.createdAt,
  };
}

export function generateId() {
  return uuidv4();
}
