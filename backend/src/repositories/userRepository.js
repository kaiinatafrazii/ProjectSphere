import { query } from '../config/db.js';

export async function findUserByEmail(email) {
  const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function createUser({ id, name, email, passwordHash, bio, avatarUrl, location, skills, role }) {
  const result = await query(
    'INSERT INTO users (id, name, email, password_hash, bio, avatar_url, location, skills, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, email, passwordHash, bio || '', avatarUrl || null, location || null, JSON.stringify(skills || []), role || 'student']
  );
  return result;
}
