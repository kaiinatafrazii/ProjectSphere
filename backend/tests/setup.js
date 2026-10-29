process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_PATH = ':memory:';
process.env.JWT_SECRET = 'projectsphere-isolated-test-secret';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sourceStorage = mkdtempSync(path.join(os.tmpdir(), 'projectsphere-private-source-'));
process.env.SOURCE_CODE_STORAGE_DIR = sourceStorage;
process.on('exit', () => rmSync(sourceStorage, { recursive: true, force: true }));
