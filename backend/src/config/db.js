import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const configuredPath = process.env.SQLITE_DB_PATH || path.join(backendDirectory, 'data', 'projectsphere.sqlite');
const databasePath = configuredPath === ':memory:'
  ? configuredPath
  : path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(backendDirectory, configuredPath);

if (databasePath !== ':memory:') {
  mkdirSync(path.dirname(databasePath), { recursive: true });
}

export const db = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
if (databasePath !== ':memory:') db.pragma('journal_mode = WAL');

const migrationPath = path.join(backendDirectory, 'migrations', 'sqlite', '001_initial.sql');
const schema = readFileSync(migrationPath, 'utf8');
const currentVersion = db.pragma('user_version', { simple: true });
if (currentVersion < 1) {
  try {
    db.transaction(() => {
      db.exec(schema);
      db.pragma('user_version = 1');
    })();
  } catch (error) {
    db.close();
    throw new Error(`Unable to initialize the SQLite database: ${error.message}`, { cause: error });
  }
}

function normalizeParameters(params) {
  return params.map((value) => (value instanceof Date ? value.toISOString() : value));
}

function executeStatement(sql, params = []) {
  const statement = db.prepare(sql);
  const values = normalizeParameters(params);
  if (statement.reader) return statement.all(...values);

  const result = statement.run(...values);
  return {
    affectedRows: result.changes,
    insertId: Number(result.lastInsertRowid),
  };
}

export const pool = {
  async execute(sql, params = []) {
    return [executeStatement(sql, params), []];
  },

  async getConnection() {
    let active = false;
    return {
      async beginTransaction() {
        db.exec('BEGIN IMMEDIATE');
        active = true;
      },
      async execute(sql, params = []) {
        return [executeStatement(sql, params), []];
      },
      async commit() {
        if (active) db.exec('COMMIT');
        active = false;
      },
      async rollback() {
        if (active) db.exec('ROLLBACK');
        active = false;
      },
      release() {},
    };
  },
};

export async function query(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

export async function isDatabaseAvailable() {
  try {
    db.prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}
