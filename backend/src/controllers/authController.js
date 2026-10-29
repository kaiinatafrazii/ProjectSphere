import jwt from 'jsonwebtoken';
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
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=500&q=80',
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
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=500&q=80',
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
