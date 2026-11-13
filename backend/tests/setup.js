process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'projectsphere-isolated-test-secret';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
process.env.DB_NAME = process.env.DB_NAME || 'projectsphere_app';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sourceStorage = mkdtempSync(path.join(os.tmpdir(), 'projectsphere-private-source-'));
process.env.SOURCE_CODE_STORAGE_DIR = sourceStorage;
process.on('exit', () => rmSync(sourceStorage, { recursive: true, force: true }));
