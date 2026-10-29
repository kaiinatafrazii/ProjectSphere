import { findUserByEmail, createUser } from '../repositories/userRepository.js';
import { buildUserView, generateId, hashPassword, signToken, verifyPassword } from '../services/authService.js';
import { sendError, sendSuccess } from '../utils/response.js';

export async function register(req, res) {
  try {
    const { name, email, password, bio, location, skills, role } = req.body;
    if (!name || !email || !password) {
      return sendError(res, 400, 'Name, email, and password are required.');
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return sendError(res, 409, 'An account with this email already exists.');
    }

    const passwordHash = await hashPassword(password);
    const id = generateId();

    await createUser({
      id,
      name,
      email,
      passwordHash,
      bio,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=500&q=80',
      location,
      skills: skills || [],
      role: role || 'student',
    });

    const user = {
      id,
      name,
      email,
      bio: bio || '',
      location: location || '',
      skills: skills || [],
      role: role || 'student',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=500&q=80',
      createdAt: new Date().toISOString(),
      savedProjects: [],
    };

    const token = signToken(user);
    return sendSuccess(res, { token, user: buildUserView(user) }, 201);
  } catch (error) {
    return sendError(res, 500, error.message || 'Unable to create account.');
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required.');
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return sendError(res, 401, 'Invalid credentials.');
    }

    const validPassword = await verifyPassword(password, user.password_hash || user.passwordHash);
    if (!validPassword) {
      return sendError(res, 401, 'Invalid credentials.');
    }

    const safeUser = buildUserView(user);
    const token = signToken(safeUser);
    return sendSuccess(res, { token, user: safeUser });
  } catch (error) {
    return sendError(res, 500, error.message || 'Unable to log in.');
  }
}
