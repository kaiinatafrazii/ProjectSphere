import { randomUUID } from 'node:crypto';
import { pool } from '../config/db.js';

export async function createUserNotification({ userId, type, title, message, entityType = null, entityId = null }, executor = pool) {
  await executor.execute(
    `INSERT INTO user_notifications (id, user_id, type, title, message, entity_type, entity_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), userId, type, title, message, entityType, entityId]
  );
}