import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDirectory = path.join(backendDirectory, 'migrations', 'mysql');
const migrations = ['001_initial.sql'];

export function getDatabaseConfig() {
  const connectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  let host = process.env.DB_HOST || '127.0.0.1';
  let port = Number(process.env.DB_PORT || 3306);
  let user = process.env.DB_USER || 'root';
  let password = process.env.DB_PASSWORD || '';
  let database = process.env.DB_NAME || 'projectsphere_app';

  if (connectionUrl) {
    try {
      const parsed = new URL(connectionUrl);
      host = parsed.hostname || host;
      port = parsed.port ? Number(parsed.port) : port;
      user = parsed.username ? decodeURIComponent(parsed.username) : user;
      password = parsed.password ? decodeURIComponent(parsed.password) : password;
      const pathname = parsed.pathname.replace(/^\//, '');
      if (pathname) database = pathname;
    } catch (err) {
      console.warn('Unable to parse DATABASE_URL / MYSQL_URL, using individual variables:', err.message);
    }
  }

  if (process.env.NODE_ENV === 'production' && (host === '127.0.0.1' || host === 'localhost')) {
    console.warn('\n⚠️  WARNING: Connecting to localhost (127.0.0.1:3306) in production!');
    console.warn('Render cannot reach XAMPP on your personal computer via localhost.');
    console.warn('Configure DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (or DATABASE_URL) in Render Dashboard -> Environment.\n');
  }

  return { host, port, user, password, database };
}

const dbConfig = getDatabaseConfig();

export const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
  dateStrings: true,
  decimalNumbers: true,
  ssl: process.env.DB_SSL === 'true'
    ? {
        ca: process.env.DB_SSL_CA || undefined,
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
      }
    : undefined,
});

pool.on('connection', (connection) => {
  connection.query("SET SESSION time_zone = '+00:00'", (error) => {
    if (error) {
      console.error('Unable to configure the MySQL session timezone:', error);
      connection.destroy();
    }
  });
});

let initialization;

export async function initializeDatabase() {
  if (!initialization) {
    initialization = (async () => {
      const activeConfig = getDatabaseConfig();
      try {
        const rootConnection = await mysql.createConnection({
          host: activeConfig.host,
          port: activeConfig.port,
          user: activeConfig.user,
          password: activeConfig.password,
          ssl: process.env.DB_SSL === 'true'
            ? {
                ca: process.env.DB_SSL_CA || undefined,
                rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
              }
            : undefined,
        });
        await rootConnection.query(
          `CREATE DATABASE IF NOT EXISTS \`${activeConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        await rootConnection.end();
      } catch (error) {
        // Cloud-hosted databases (e.g. Render) may pre-create the DB or restrict CREATE DATABASE.
      }

      const connection = await pool.getConnection();
      try {
        await connection.execute(
          `CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(191) NOT NULL PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        );
        const [appliedRows] = await connection.execute('SELECT version FROM schema_migrations');
        const appliedVersions = new Set(appliedRows.map((row) => row.version));

        for (const migration of migrations) {
          if (appliedVersions.has(migration)) continue;
          const sql = await readFile(path.join(migrationsDirectory, migration), 'utf8');
          for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
            await connection.query(statement);
          }
          await connection.execute('INSERT INTO schema_migrations (version) VALUES (?)', [migration]);
        }
      } finally {
        connection.release();
      }
    })().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function isDatabaseAvailable() {
  try {
    await pool.execute('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase() {
  await pool.end();
}
