import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../src/app.js';
import { db } from '../src/config/db.js';
import { pool } from '../src/config/db.js';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('SQLite initializes persistently and supports the account, project, review, bookmark, and moderation flows', async (context) => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name);
  for (const table of [
    'users', 'projects', 'project_reviews', 'saved_projects', 'auth_sessions',
    'contact_messages', 'project_moderation_history',
  ]) {
    assert.ok(tables.includes(table), `${table} table exists`);
  }
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_projects_status_created'").get());

  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'projectsphere-sqlite-'));
  const databasePath = path.join(temporaryDirectory, 'persistent.sqlite');
  context.after(() => rmSync(temporaryDirectory, { recursive: true, force: true }));
  const childEnv = {
    ...process.env,
    SQLITE_DB_PATH: databasePath,
    NODE_ENV: 'test',
    JWT_SECRET: 'projectsphere-persistence-test-secret',
  };
  const insertScript = `
    import { db } from './src/config/db.js';
    db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run('persisted-user', 'Persistent User', 'persisted@example.test', 'hash');
    db.close();
  `;
  const verifyScript = `
    import { db } from './src/config/db.js';
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get('persisted-user');
    if (user?.name !== 'Persistent User') process.exitCode = 1;
    db.close();
  `;
  for (const script of [insertScript, verifyScript]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: backendDirectory,
      env: childEnv,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  }

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  async function request(url, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }

  async function register(email, name) {
    const response = await request('/auth/register', {
      method: 'POST',
      body: { email, name, password: 'secure-password-123' },
    });
    assert.equal(response.status, 201);
    assert.ok(response.cookie);
    return { user: response.body.user, cookie: response.cookie };
  }

  const owner = await register('owner@example.test', 'Project Owner');
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: 'owner@example.test', password: 'secure-password-123' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'student');
  assert.ok(login.cookie);

  const projectResponse = await request('/projects', {
    method: 'POST',
    cookie: owner.cookie,
    body: {
      title: 'SQLite Integration Project',
      tagline: 'A project used for persistent integration tests.',
      category: 'Developer Tools',
      techStack: ['Node.js', 'SQLite'],
      summary: 'A full-stack project submitted for review.',
      overview: 'The application stores projects and moderation data in SQLite.',
    },
  });
  assert.equal(projectResponse.status, 201);
  const projectId = projectResponse.body.projectId;
  assert.equal(db.prepare('SELECT status FROM projects WHERE id = ?').get(projectId).status, 'pending');

  const reviewer = await register('reviewer@example.test', 'Project Reviewer');
  const regularUserAdminAccess = await request('/admin/overview', { cookie: reviewer.cookie });
  assert.equal(regularUserAdminAccess.status, 403);

  const wrongOwnerEdit = await request(`/projects/${projectId}`, {
    method: 'PUT',
    cookie: reviewer.cookie,
    body: {
      title: 'Unauthorized edit',
      tagline: 'Not allowed.',
      category: 'Developer Tools',
      techStack: [],
      summary: 'Unauthorized.',
      overview: 'A different user cannot edit this project.',
    },
  });
  assert.equal(wrongOwnerEdit.status, 404);

  const admin = await register('admin@example.test', 'Project Admin');
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(admin.user.id);
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.test', password: 'secure-password-123' },
  });
  assert.equal(adminLogin.body.user.role, 'admin');
  const adminProjects = await request('/admin/projects?status=pending', { cookie: adminLogin.cookie });
  assert.equal(adminProjects.status, 200);
  assert.ok(adminProjects.body.projects.some((project) => project.id === projectId));

  const rejected = await request(`/admin/projects/${projectId}/moderate`, {
    method: 'POST',
    cookie: adminLogin.cookie,
    body: { action: 'reject', feedback: 'Add setup and deployment instructions.' },
  });
  assert.equal(rejected.status, 200);
  const ownerProjects = await request('/projects/mine', { cookie: owner.cookie });
  assert.equal(ownerProjects.body.projects[0].status, 'rejected');
  assert.equal(ownerProjects.body.projects[0].moderationFeedback, 'Add setup and deployment instructions.');

  await request(`/admin/projects/${projectId}/moderate`, {
    method: 'POST',
    cookie: adminLogin.cookie,
    body: { action: 'approve', feedback: '' },
  }).then((response) => assert.equal(response.status, 200));
  const discovered = await request('/projects');
  assert.ok(discovered.body.projects.some((project) => project.id === projectId));

  const firstReview = await request(`/projects/${projectId}/reviews`, {
    method: 'POST',
    cookie: reviewer.cookie,
    body: { rating: 5, comment: 'Good project.' },
  });
  const updatedReview = await request(`/projects/${projectId}/reviews`, {
    method: 'POST',
    cookie: reviewer.cookie,
    body: { rating: 3, comment: 'Useful documentation needed.' },
  });
  assert.equal(firstReview.status, 201);
  assert.equal(updatedReview.status, 201);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_reviews WHERE project_id = ? AND user_id = ?').get(projectId, reviewer.user.id).count, 1);
  assert.equal(db.prepare('SELECT rating FROM project_reviews WHERE project_id = ? AND user_id = ?').get(projectId, reviewer.user.id).rating, 3);

  const ownerReview = await request(`/projects/${projectId}/reviews`, {
    method: 'POST',
    cookie: owner.cookie,
    body: { rating: 4, comment: 'I own this.' },
  });
  assert.equal(ownerReview.status, 403);

  const bookmark = await request(`/projects/${projectId}/bookmark`, { method: 'POST', cookie: reviewer.cookie });
  assert.equal(bookmark.status, 200);
  const bookmarks = await request('/users/me/bookmarks', { cookie: reviewer.cookie });
  assert.equal(bookmarks.body.projects.length, 1);

  const dashboard = await request('/projects/dashboard', { cookie: owner.cookie });
  assert.equal(dashboard.body.stats.totalReviews, 1);
  assert.equal(dashboard.body.stats.averageRating, 3);
  const moderationHistory = await request('/admin/history', { cookie: adminLogin.cookie });
  assert.equal(moderationHistory.body.history.length, 2);

  const privateFeedback = await request('/admin/history', { cookie: reviewer.cookie });
  assert.equal(privateFeedback.status, 403);

  const failureResponse = await request('/projects/not-a-project/reviews', {
    method: 'POST',
    cookie: reviewer.cookie,
    body: { rating: 1, comment: 'No project exists.' },
  });
  assert.equal(failureResponse.status, 404);
  assert.doesNotMatch(JSON.stringify(failureResponse.body), /SQLITE|database|persistent\.sqlite/i);

  context.mock.method(pool, 'execute', async () => {
    throw new Error('private database path /never-return-this.sqlite');
  });
  const errorLogger = context.mock.method(console, 'error', () => {});
  const unavailableDatabaseResponse = await request('/contact', {
    method: 'POST',
    body: {
      name: 'Test Sender',
      email: 'sender@example.test',
      subject: 'Database failure handling',
      message: 'This request runs after the isolated test database closes.',
    },
  });
  assert.equal(unavailableDatabaseResponse.status, 500);
  assert.equal(unavailableDatabaseResponse.body.message, 'We could not send your message right now. Please try again later.');
  assert.doesNotMatch(JSON.stringify(unavailableDatabaseResponse.body), /SQLITE|database|persistent\.sqlite/i);
  assert.equal(errorLogger.mock.callCount(), 1);
});
