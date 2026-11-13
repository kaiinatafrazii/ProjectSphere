import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';

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

  const [{ closeDatabase, initializeDatabase, pool }, { hashPassword }] = await Promise.all([
    import('../src/config/db.js'),
    import('../src/services/authService.js'),
  ]);
  try {
    await initializeDatabase();
    const passwordHash = await hashPassword(password);
    const connection = await pool.getConnection();
    let updated = false;
    try {
      await connection.beginTransaction();
      const [existingRows] = await connection.execute(
        'SELECT id FROM users WHERE email = ? FOR UPDATE',
        [email]
      );
      const existing = existingRows[0];
      if (existing) {
        await connection.execute(
          `UPDATE users
           SET role = 'admin', password_hash = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [passwordHash, existing.id]
        );
        await connection.execute(
          'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
          [existing.id]
        );
        updated = true;
      } else {
        await connection.execute(
          `INSERT INTO users (id, name, email, password_hash, role)
           VALUES (?, 'ProjectSphere Admin', ?, ?, 'admin')`,
          [randomUUID(), email, passwordHash]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    console.log(`${updated ? 'Updated' : 'Created'} the development administrator account ${email}.`);
  } finally {
    await closeDatabase();
  }
}

setupDevelopmentAdmin().catch((error) => {
  console.error(`Development admin setup failed: ${error.message}`);
  process.exitCode = 1;
});
