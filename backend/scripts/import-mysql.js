import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { db } from '../src/config/db.js';

dotenv.config();

const tableDefinitions = [
  {
    name: 'users',
    columns: ['id', 'name', 'email', 'password_hash', 'bio', 'avatar_url', 'location', 'skills', 'role', 'created_at', 'updated_at'],
    map(row) {
      return [
        row.id, row.name, row.email, row.password_hash, row.bio || '', row.avatar_url || null,
        row.location || null, jsonText(row.skills), row.role || 'student', timestamp(row.created_at), timestamp(row.updated_at),
      ];
    },
  },
  {
    name: 'projects',
    columns: ['id', 'user_id', 'title', 'tagline', 'category', 'tech_stack', 'summary', 'overview', 'repo_url', 'live_url', 'screenshot_url', 'likes', 'views', 'status', 'created_at', 'updated_at'],
    map(row) {
      return [
        row.id, row.user_id, row.title, row.tagline, row.category, jsonText(row.tech_stack), row.summary, row.overview,
        row.repo_url || null, row.live_url || null, row.screenshot_url || null, Number(row.likes || 0), Number(row.views || 0),
        row.status || 'pending', timestamp(row.created_at), timestamp(row.updated_at),
      ];
    },
  },
  {
    name: 'project_reviews',
    columns: ['id', 'project_id', 'user_id', 'rating', 'comment', 'created_at', 'updated_at'],
    map(row) {
      return [row.id, row.project_id, row.user_id, Number(row.rating), row.comment, timestamp(row.created_at), timestamp(row.updated_at || row.created_at)];
    },
  },
  {
    name: 'saved_projects',
    columns: ['id', 'user_id', 'project_id', 'created_at'],
    map(row) {
      return [row.id, row.user_id, row.project_id, timestamp(row.created_at)];
    },
  },
  {
    name: 'auth_sessions',
    columns: ['id', 'user_id', 'expires_at', 'revoked_at', 'created_at'],
    map(row) {
      return [row.id, row.user_id, timestamp(row.expires_at), timestamp(row.revoked_at), timestamp(row.created_at)];
    },
  },
  {
    name: 'contact_messages',
    columns: ['id', 'name', 'email', 'subject', 'message', 'created_at'],
    map(row) {
      return [row.id, row.name, row.email, row.subject, row.message, timestamp(row.created_at)];
    },
  },
  {
    name: 'project_moderation_history',
    columns: ['id', 'project_id', 'admin_id', 'action', 'previous_status', 'resulting_status', 'feedback', 'created_at'],
    map(row) {
      return [
        row.id, row.project_id, row.admin_id, row.action, row.previous_status, row.resulting_status,
        row.feedback || null, timestamp(row.created_at),
      ];
    },
  },
];

function jsonText(value) {
  if (value === null || value === undefined) return '[]';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function timestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

async function main() {
  const source = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'projectsphere',
    charset: 'utf8mb4',
  });

  try {
    const [tableRows] = await source.query('SHOW TABLES');
    const availableTables = new Set(tableRows.map((row) => Object.values(row)[0]));
    if (!availableTables.has('users') || !availableTables.has('projects')) {
      throw new Error('The configured MySQL schema must contain users and projects tables.');
    }

    const importedData = [];
    for (const definition of tableDefinitions) {
      if (!availableTables.has(definition.name)) continue;
      const [rows] = await source.query(`SELECT * FROM \`${definition.name}\``);
      importedData.push({ definition, rows });
    }

    const transaction = db.transaction((tables) => {
      const counts = {};
      for (const { definition, rows } of tables) {
        const columns = definition.columns;
        const placeholders = columns.map(() => '?').join(', ');
        const updates = columns
          .filter((column) => column !== 'id')
          .map((column) => `${column} = excluded.${column}`)
          .join(', ');
        const statement = db.prepare(
          `INSERT INTO ${definition.name} (${columns.join(', ')}) VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE SET ${updates}`
        );
        for (const row of rows) statement.run(...definition.map(row));
        counts[definition.name] = rows.length;
      }
      return counts;
    });

    const counts = transaction(importedData);
    console.log(`Imported MySQL records into SQLite at ${process.env.SQLITE_DB_PATH || 'backend/data/projectsphere.sqlite'}:`);
    for (const [table, count] of Object.entries(counts)) console.log(`  ${table}: ${count}`);
  } finally {
    await source.end();
    db.close();
  }
}

main().catch((error) => {
  console.error(`MySQL-to-SQLite import failed: ${error.message}`);
  process.exitCode = 1;
});
