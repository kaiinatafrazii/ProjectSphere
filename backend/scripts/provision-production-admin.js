import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

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

  const [{ db }, { hashPassword }] = await Promise.all([
    import('../src/config/db.js'),
    import('../src/services/authService.js'),
  ]);
  try {
    const existing = db.prepare('SELECT id, role FROM users WHERE email = ? COLLATE NOCASE').get(expectedEmail);
    if (existing?.role === 'admin') {
      throw new Error('The one-time administrator account is already provisioned.');
    }
    const adminCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count;
    if (adminCount > 0) {
      throw new Error('An administrator already exists; use the established recovery process.');
    }

    const id = existing?.id || randomUUID();
    const passwordHash = await hashPassword(password);
    db.transaction(() => {
      if (existing) {
        db.prepare(
          `UPDATE users SET role = 'admin', account_status = 'active', password_hash = ?,
           updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(passwordHash, id);
      } else {
        db.prepare(
          `INSERT INTO users (id, name, email, password_hash, role, account_status)
           VALUES (?, 'ProjectSphere Admin', ?, ?, 'admin', 'active')`
        ).run(id, expectedEmail, passwordHash);
      }
      db.prepare(
        'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL'
      ).run(id);
      db.prepare(
        `INSERT INTO admin_audit_events
         (id, admin_id, action, target_type, target_id, previous_state, new_state, details)
         VALUES (?, ?, 'admin_provisioned', 'user', ?, ?, 'admin', 'One-time production provisioning')`
      ).run(randomUUID(), id, id, existing?.role || null);
    })();
    console.log('Provisioned the designated ProjectSphere administrator.');
  } finally {
    if (db.open) db.close();
  }
}

provisionProductionAdmin().catch((error) => {
  console.error(`Production admin provisioning failed: ${error.message}`);
  process.exitCode = 1;
});
