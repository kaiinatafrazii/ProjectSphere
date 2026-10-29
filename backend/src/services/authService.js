import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'student',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function buildUserView(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio || '',
    location: user.location || '',
    skills: user.skills || [],
    role: user.role || 'student',
    avatarUrl: user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=500&q=80',
    savedProjects: user.savedProjects || [],
    createdAt: user.createdAt,
  };
}

export function generateId() {
  return uuidv4();
}
