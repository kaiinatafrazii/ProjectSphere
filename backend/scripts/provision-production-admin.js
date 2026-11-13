import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';

dotenv.config();

const expectedEmail = 'kainatafrazii11@gmail.com';

async function provisionProductionAdmin() {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Production admin provisioning requires NODE_ENV=production.');
  }
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (email !== expectedEmail) {
    throw new Error('Set ADMIN_EMAIL to the designated administrator email.');
  }
  if (password.length < 12 || password.length > 72) {
    throw new Error('Set ADMIN_PASSWORD to a unique 12-72 character password.');
  }

  const [{ closeDatabase, initializeDatabase, pool }, { hashPassword }] = await Promise.all([
    import('../src/config/db.js'),
    import('../src/services/authService.js'),
  ]);
  try {
    await initializeDatabase();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existingRows] = await connection.execute(
        'SELECT id, role FROM users WHERE email = ? FOR UPDATE',
        [expectedEmail]
      );
      const existing = existingRows[0];
      if (existing?.role === 'admin') {
        throw new Error('The one-time administrator account is already provisioned.');
      }
      const [adminRows] = await connection.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
      if (Number(adminRows[0].count) > 0) {
        throw new Error('An administrator already exists; use the established recovery process.');
      }

      const id = existing?.id || randomUUID();
      const passwordHash = await hashPassword(password);
      if (existing) {
        await connection.execute(
          `UPDATE users SET role = 'admin', account_status = 'active', password_hash = ?,
           updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [passwordHash, id]
        );
      } else {
        await connection.execute(
          `INSERT INTO users (id, name, email, password_hash, role, account_status)
           VALUES (?, 'ProjectSphere Admin', ?, ?, 'admin', 'active')`,
          [id, expectedEmail, passwordHash]
        );
      }
      await connection.execute(
        'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
        [id]
      );
      await connection.execute(
        `INSERT INTO admin_audit_events
         (id, admin_id, action, target_type, target_id, previous_state, new_state, details)
         VALUES (?, ?, 'admin_provisioned', 'user', ?, ?, 'admin', 'One-time production provisioning')`,
        [randomUUID(), id, id, existing?.role || null]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    console.log('Provisioned the designated ProjectSphere administrator.');
  } finally {
    await closeDatabase();
  }
}

provisionProductionAdmin().catch((error) => {
  console.error(`Production admin provisioning failed: ${error.message}`);
  process.exitCode = 1;
});
