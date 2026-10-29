import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

async function setupDevelopmentAdmin() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development admin setup is disabled in production.');
  }

  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set ADMIN_EMAIL to a valid development admin email.');
  }
  if (password.length < 8 || password.length > 72) {
    throw new Error('Set ADMIN_PASSWORD to 8-72 characters before setup.');
  }

  const [{ db }, { hashPassword }] = await Promise.all([
    import('../src/config/db.js'),
    import('../src/services/authService.js'),
  ]);
  try {
    const passwordHash = await hashPassword(password);
    const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
    const setupAccount = db.transaction(() => {
      if (existing) {
        db.prepare(
          `UPDATE users
           SET role = 'admin', password_hash = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run(passwordHash, existing.id);
        db.prepare(
          'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL'
        ).run(existing.id);
        return;
      }

      const id = randomUUID();
      db.prepare(
        `INSERT INTO users (id, name, email, password_hash, role)
         VALUES (?, 'ProjectSphere Admin', ?, ?, 'admin')`
      ).run(id, email, passwordHash);
    });
    setupAccount();
    if (existing) {
      console.log(`Updated the development administrator account ${email}.`);
      return;
    }
    console.log(`Created the development administrator account ${email}.`);
  } finally {
    if (db.open) db.close();
  }
}

setupDevelopmentAdmin()
  .catch((error) => {
    console.error(`Development admin setup failed: ${error.message}`);
    process.exitCode = 1;
  });
