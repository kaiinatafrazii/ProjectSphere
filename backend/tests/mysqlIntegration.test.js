import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../src/app.js';
import { pool, query, initializeDatabase, closeDatabase } from '../src/config/db.js';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createZipArchive() {
  const filename = Buffer.from('main.js');
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(filename.length, 26);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(filename.length, 28);
  const centralDirectory = Buffer.concat([centralHeader, filename]);

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(1, 8);
  endRecord.writeUInt16LE(1, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localHeader.length + filename.length, 16);
  return Buffer.concat([localHeader, filename, centralDirectory, endRecord]);
}

test('MySQL initializes all tables and supports complete authentication, registration, projects, reviews, bookmarks, and moderation flows', async (context) => {
  await initializeDatabase();

  const [tableRows] = await pool.execute('SHOW TABLES');
  const tables = tableRows.map((row) => Object.values(row)[0]);
  for (const table of [
    'users', 'projects', 'project_reviews', 'saved_projects', 'auth_sessions',
    'contact_messages', 'project_moderation_history', 'project_source_code',
    'user_notifications', 'project_reports', 'admin_audit_events', 'password_reset_tokens',
    'user_preferences', 'email_change_tokens',
  ]) {
    assert.ok(tables.includes(table), `${table} table exists in MySQL`);
  }

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  async function request(url, { method = 'GET', body, cookie } = {}) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: {
        ...(body && !isFormData ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
    });
    const contentType = response.headers.get('content-type') || '';
    return {
      status: response.status,
      body: contentType.includes('application/json') ? await response.json() : await response.arrayBuffer(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }

  const testSuffix = Date.now();
  const ownerEmail = `owner_${testSuffix}@example.test`;
  const reviewerEmail = `reviewer_${testSuffix}@example.test`;
  const adminEmail = `admin_${testSuffix}@example.test`;

  async function register(email, name) {
    const response = await request('/auth/register', {
      method: 'POST',
      body: { email, name, password: 'secure-password-123' },
    });
    assert.equal(response.status, 201);
    assert.ok(response.cookie);
    return { user: response.body.user, cookie: response.cookie };
  }

  // 1. Registration
  const owner = await register(ownerEmail, 'Project Owner');
  assert.equal(owner.user.email, ownerEmail);
  assert.equal(owner.user.role, 'student');

  // Duplicate registration rejection
  const duplicateRegister = await request('/auth/register', {
    method: 'POST',
    body: { email: ownerEmail, name: 'Duplicate User', password: 'secure-password-123' },
  });
  assert.equal(duplicateRegister.status, 409);

  // 2. Login
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: ownerEmail, password: 'secure-password-123' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'student');
  assert.ok(login.cookie);

  // Invalid login
  const invalidLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: ownerEmail, password: 'wrong-password' },
  });
  assert.equal(invalidLogin.status, 401);

  // 3. Session restore (/auth/me)
  const me = await request('/auth/me', { cookie: owner.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.id, owner.user.id);

  // 4. Update profile
  const profilePhoto = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;
  const profileUpdate = await request('/users/me', {
    method: 'PUT',
    cookie: owner.cookie,
    body: {
      name: 'Updated Project Owner',
      bio: 'A profile updated in MySQL integration test.',
      location: 'Remote',
      skills: ['MySQL', 'React', 'Node.js'],
      avatarUrl: profilePhoto,
      username: `owner_${testSuffix}`,
      githubUrl: 'https://github.com/project-owner',
      linkedinUrl: 'https://www.linkedin.com/in/project-owner',
      websiteUrl: 'https://project-owner.example.test',
    },
  });
  assert.equal(profileUpdate.status, 200);
  assert.equal(profileUpdate.body.user.username, `owner_${testSuffix}`);
  assert.equal(profileUpdate.body.user.avatarUrl, profilePhoto);

  // 5. Submit project
  const projectResponse = await request('/projects', {
    method: 'POST',
    cookie: owner.cookie,
    body: {
      title: 'MySQL Integration Project',
      tagline: 'A project used for MySQL integration tests.',
      category: 'Developer Tools',
      techStack: ['Node.js', 'MySQL', 'React'],
      summary: 'A full-stack project submitted for review.',
      overview: 'The application stores projects and moderation data in MySQL.',
    },
  });
  assert.equal(projectResponse.status, 201);
  const projectId = projectResponse.body.projectId;

  const [projectStatusRows] = await pool.execute('SELECT status FROM projects WHERE id = ?', [projectId]);
  assert.equal(projectStatusRows[0].status, 'pending');

  // Pending project is not in public listing
  const pendingProjectsForPublic = await request('/projects');
  assert.equal(pendingProjectsForPublic.body.projects.some((p) => p.id === projectId), false);

  // 6. Admin user and moderation
  const admin = await register(adminEmail, 'Project Admin');
  await pool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [admin.user.id]);

  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: 'secure-password-123' },
  });
  assert.equal(adminLogin.body.user.role, 'admin');

  // Moderate project -> approve
  const approveResponse = await request(`/admin/projects/${projectId}/moderate`, {
    method: 'POST',
    cookie: adminLogin.cookie,
    body: { action: 'approve', feedback: 'Approved for showcase.' },
  });
  assert.equal(approveResponse.status, 200);

  // Now project is published and visible publicly
  const publishedProjects = await request('/projects');
  assert.ok(publishedProjects.body.projects.some((p) => p.id === projectId));

  // 7. Review system
  const reviewer = await register(reviewerEmail, 'Project Reviewer');
  const reviewResponse = await request(`/projects/${projectId}/reviews`, {
    method: 'POST',
    cookie: reviewer.cookie,
    body: { rating: 5, comment: 'Exceptional MySQL integration!' },
  });
  assert.equal(reviewResponse.status, 201);

  // Owner cannot review own project
  const ownerReviewResponse = await request(`/projects/${projectId}/reviews`, {
    method: 'POST',
    cookie: owner.cookie,
    body: { rating: 5, comment: 'I built this.' },
  });
  assert.equal(ownerReviewResponse.status, 403);

  // 8. Bookmarks
  const bookmarkResponse = await request(`/projects/${projectId}/bookmark`, {
    method: 'POST',
    cookie: reviewer.cookie,
  });
  assert.equal(bookmarkResponse.status, 200);
  assert.equal(bookmarkResponse.body.saved, true);

  const bookmarksList = await request('/users/me/bookmarks', { cookie: reviewer.cookie });
  assert.equal(bookmarksList.status, 200);
  assert.ok(bookmarksList.body.projects.some((p) => p.id === projectId));

  // 9. Contact messages
  const contactSubmission = await request('/contact', {
    method: 'POST',
    body: {
      name: 'Test Contact',
      email: 'testcontact@example.test',
      subject: 'Integration Test Question',
      message: 'Verifying contact submission in MySQL.',
    },
  });
  assert.equal(contactSubmission.status, 201);
  assert.equal(contactSubmission.body.success, true);

  // 10. Logout
  const logoutResponse = await request('/auth/logout', {
    method: 'POST',
    cookie: owner.cookie,
  });
  assert.equal(logoutResponse.status, 200);
});

test.after(async () => {
  await closeDatabase();
});

test('development admin setup script initializes or updates administrator in MySQL', async () => {
  const childEnv = {
    ...process.env,
    NODE_ENV: 'development',
    ADMIN_EMAIL: 'dev_admin_test@example.test',
    ADMIN_PASSWORD: 'DevAdminSecurePassword123!',
  };
  const setup = spawnSync(process.execPath, ['scripts/setup-development-admin.js'], {
    cwd: backendDirectory,
    env: childEnv,
    encoding: 'utf8',
  });
  assert.equal(setup.status, 0, setup.stderr);

  const [adminRows] = await pool.execute('SELECT email, role FROM users WHERE email = ?', ['dev_admin_test@example.test']);
  assert.equal(adminRows.length, 1);
  assert.equal(adminRows[0].role, 'admin');
});
