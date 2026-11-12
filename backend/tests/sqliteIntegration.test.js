import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import Database from 'better-sqlite3';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../src/app.js';
import { db } from '../src/config/db.js';
import { pool } from '../src/config/db.js';

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

test('SQLite initializes persistently and supports the account, project, review, bookmark, and moderation flows', async (context) => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name);
  for (const table of [
    'users', 'projects', 'project_reviews', 'saved_projects', 'auth_sessions',
    'contact_messages', 'project_moderation_history', 'project_source_code',
    'user_notifications', 'project_reports', 'admin_audit_events', 'password_reset_tokens',
    'user_preferences', 'email_change_tokens',
  ]) {
    assert.ok(tables.includes(table), `${table} table exists`);
  }
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  assert.equal(db.pragma('user_version', { simple: true }), 6);
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_contact_messages_read_created'").get());
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
  const profilePhoto = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;
  const profileUpdate = await request('/users/me', {
    method: 'PUT',
    cookie: owner.cookie,
    body: {
      name: 'Updated Project Owner',
      bio: 'A profile updated in the integration test.',
      location: 'Remote',
      skills: ['SQLite', 'React'],
      avatarUrl: profilePhoto,
      username: 'project_owner',
      githubUrl: 'https://github.com/project-owner',
      linkedinUrl: 'https://www.linkedin.com/in/project-owner',
      websiteUrl: 'https://project-owner.example.test',
      role: 'admin',
    },
  });
  assert.equal(profileUpdate.status, 200);
  assert.equal(profileUpdate.body.user.avatarUrl, profilePhoto);
  assert.equal(profileUpdate.body.user.username, 'project_owner');
  assert.equal(profileUpdate.body.user.githubUrl, 'https://github.com/project-owner');
  assert.equal(profileUpdate.body.user.role, 'student');
  assert.equal(db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(owner.user.id).avatar_url, profilePhoto);
  assert.equal(db.prepare('SELECT username FROM users WHERE id = ?').get(owner.user.id).username, 'project_owner');
  const restoredProfile = await request('/auth/me', { cookie: owner.cookie });
  assert.equal(restoredProfile.body.user.avatarUrl, profilePhoto);
  const profileUpdateWithoutPhoto = await request('/users/me', {
    method: 'PUT',
    cookie: owner.cookie,
    body: { name: 'Updated Project Owner', bio: '', location: '', skills: [] },
  });
  assert.equal(profileUpdateWithoutPhoto.status, 200);
  assert.equal(db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(owner.user.id).avatar_url, profilePhoto);
  const invalidProfilePhoto = await request('/users/me', {
    method: 'PUT',
    cookie: owner.cookie,
    body: {
      name: 'Updated Project Owner',
      bio: '',
      location: '',
      skills: [],
      avatarUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZQ==',
    },
  });
  assert.equal(invalidProfilePhoto.status, 400);
  const invalidProfilePhotoType = await request('/users/me', {
    method: 'PUT',
    cookie: owner.cookie,
    body: { name: 'Updated Project Owner', bio: '', location: '', skills: [], avatarUrl: 42 },
  });
  assert.equal(invalidProfilePhotoType.status, 400);
  const removedProfilePhoto = await request('/users/me', {
    method: 'PUT',
    cookie: owner.cookie,
    body: {
      name: 'Updated Project Owner',
      bio: '',
      location: '',
      skills: [],
      avatarUrl: '',
    },
  });
  assert.equal(removedProfilePhoto.status, 200);
  assert.equal(removedProfilePhoto.body.user.avatarUrl, null);
  assert.equal(db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(owner.user.id).avatar_url, null);
  const restoredAfterPhotoRemoval = await request('/auth/me', { cookie: owner.cookie });
  assert.equal(restoredAfterPhotoRemoval.body.user.avatarUrl, null);

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
  const pendingProjectsForPublic = await request('/projects');
  assert.equal(pendingProjectsForPublic.body.projects.some((project) => project.id === projectId), false);
  const pendingProjectDetails = await request(`/projects/${projectId}`);
  assert.equal(pendingProjectDetails.status, 404);
  const pendingProjectOwner = await request(`/projects/${projectId}/source-code`, { cookie: reviewer.cookie });
  assert.equal(pendingProjectOwner.status, 404);
  const anonymousSourceMetadata = await request(`/projects/${projectId}/source-code`);
  assert.equal(anonymousSourceMetadata.status, 401);

  const invalidArchive = new FormData();
  invalidArchive.append('sourceCode', new Blob(['not a zip'], { type: 'application/zip' }), 'invalid.zip');
  const invalidArchiveResponse = await request(`/projects/${projectId}/source-code`, {
    method: 'POST',
    cookie: owner.cookie,
    body: invalidArchive,
  });
  assert.equal(invalidArchiveResponse.status, 400);
  const truncatedArchive = new FormData();
  truncatedArchive.append('sourceCode', new Blob([Buffer.from([0x50, 0x4b, 0x03, 0x04])], { type: 'application/zip' }), 'truncated.zip');
  const truncatedArchiveResponse = await request(`/projects/${projectId}/source-code`, {
    method: 'POST',
    cookie: owner.cookie,
    body: truncatedArchive,
  });
  assert.equal(truncatedArchiveResponse.status, 400);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_source_code WHERE project_id = ?').get(projectId).count, 0);

  const sourceArchive = new FormData();
  const zipBytes = createZipArchive();
  sourceArchive.append('sourceCode', new Blob([zipBytes], { type: 'application/zip' }), '../../private-project.zip');
  const uploadedArchive = await request(`/projects/${projectId}/source-code`, {
    method: 'POST',
    cookie: owner.cookie,
    body: sourceArchive,
  });
  assert.equal(uploadedArchive.status, 201);
  assert.equal(uploadedArchive.body.sourceCode.originalFilename, 'private-project.zip');
  assert.equal(Object.hasOwn(uploadedArchive.body.sourceCode, 'storageKey'), false);
  const reviewerSourceMetadata = await request(`/projects/${projectId}/source-code`, { cookie: reviewer.cookie });
  assert.equal(reviewerSourceMetadata.status, 404);
  const ownerSourceMetadata = await request(`/projects/${projectId}/source-code`, { cookie: owner.cookie });
  assert.equal(ownerSourceMetadata.status, 200);
  assert.equal(ownerSourceMetadata.body.sourceCode.originalFilename, 'private-project.zip');
  const nonOwnerArchiveAttempt = new FormData();
  nonOwnerArchiveAttempt.append('sourceCode', new Blob([Buffer.from([0x50, 0x4b, 0x03, 0x04])], { type: 'application/zip' }), 'other.zip');
  const reviewerUploadAttempt = await request(`/projects/${projectId}/source-code`, {
    method: 'POST',
    cookie: reviewer.cookie,
    body: nonOwnerArchiveAttempt,
  });
  assert.equal(reviewerUploadAttempt.status, 404);
  const reviewerSourceDownload = await request(`/admin/projects/${projectId}/source-code/download`, { cookie: reviewer.cookie });
  assert.equal(reviewerSourceDownload.status, 403);
  const anonymousSourceDownload = await request(`/admin/projects/${projectId}/source-code/download`);
  assert.equal(anonymousSourceDownload.status, 401);

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
  const adminOverview = await request('/admin/overview', { cookie: adminLogin.cookie });
  assert.equal(adminOverview.status, 200);
  assert.equal(adminOverview.body.stats.averageRating, null);
    const analytics = await request('/admin/analytics', { cookie: adminLogin.cookie });
    assert.equal(analytics.status, 200);
    assert.equal(analytics.body.monthly.length, 12);
    assert.equal(analytics.body.summary.totalUsers, 3);
    assert.equal((await request('/admin/analytics', { cookie: reviewer.cookie })).status, 403);
  const adminUserList = await request('/admin/users?role=student&sort=oldest', { cookie: adminLogin.cookie });
  assert.equal(adminUserList.status, 200);
  assert.ok(adminUserList.body.users.some((user) => user.id === owner.user.id));
  const userDetails = await request(`/admin/users/${owner.user.id}`, { cookie: adminLogin.cookie });
  assert.equal(userDetails.status, 200);
  assert.equal(userDetails.body.projects[0].id, projectId);

  const contactSubmission = await request('/contact', {
    method: 'POST',
    body: {
      name: 'Contact Sender',
      email: 'contact@example.test',
      subject: 'Help with my account',
      message: 'Please help me update my account details.',
    },
  });
  assert.equal(contactSubmission.status, 201);
  const contactMessages = await request('/admin/contact-messages?unread=true', { cookie: adminLogin.cookie });
  assert.equal(contactMessages.status, 200);
  assert.equal(contactMessages.body.messages.length, 1);
  assert.equal(contactMessages.body.messages[0].isRead, 0);
  const contactMessageId = contactMessages.body.messages[0].id;
  const markContactRead = await request(`/admin/contact-messages/${contactMessageId}`, {
    method: 'PATCH',
    cookie: adminLogin.cookie,
    body: { isRead: true },
  });
  assert.equal(markContactRead.status, 200);
  assert.equal(db.prepare('SELECT is_read FROM contact_messages WHERE id = ?').get(contactMessageId).is_read, 1);
  const privateContactAccess = await request('/admin/contact-messages', { cookie: reviewer.cookie });
  assert.equal(privateContactAccess.status, 403);

  const adminProfile = await request('/admin/profile', { cookie: adminLogin.cookie });
  assert.equal(adminProfile.status, 200);
  assert.equal(adminProfile.body.user.email, 'admin@example.test');
  const adminProjects = await request('/admin/projects?status=pending', { cookie: adminLogin.cookie });
  assert.equal(adminProjects.status, 200);
  assert.ok(adminProjects.body.projects.some((project) => project.id === projectId));
  assert.deepEqual(adminProjects.body.projects.find((project) => project.id === projectId).techStack, ['Node.js', 'SQLite']);
  const adminProjectDetails = await request(`/admin/projects/${projectId}`, { cookie: adminLogin.cookie });
  assert.equal(adminProjectDetails.status, 200);
  assert.equal(adminProjectDetails.body.project.ownerEmail, 'owner@example.test');
  assert.equal(adminProjectDetails.body.project.sourceCode.originalFilename, 'private-project.zip');
  assert.equal(Object.hasOwn(adminProjectDetails.body.project.sourceCode, 'storageKey'), false);
  const adminArchiveDownload = await request(`/admin/projects/${projectId}/source-code/download`, { cookie: adminLogin.cookie });
  assert.equal(adminArchiveDownload.status, 200);
  assert.deepEqual(Buffer.from(adminArchiveDownload.body), zipBytes);

  const rejected = await request(`/admin/projects/${projectId}/moderate`, {
    method: 'POST',
    cookie: adminLogin.cookie,
    body: { action: 'reject', feedback: 'Add setup and deployment instructions.' },
  });
  assert.equal(rejected.status, 200);
  const ownerProjects = await request('/projects/mine', { cookie: owner.cookie });
  assert.equal(ownerProjects.body.projects[0].status, 'rejected');
  assert.equal(ownerProjects.body.projects[0].moderationFeedback, 'Add setup and deployment instructions.');
  assert.equal((await request(`/projects/${projectId}`)).status, 404);
  assert.equal((await request(`/admin/projects/${projectId}/source-code/download`, { cookie: adminLogin.cookie })).status, 200);

  await request(`/admin/projects/${projectId}/moderate`, {
    method: 'POST',
    cookie: adminLogin.cookie,
    body: { action: 'approve', feedback: '' },
  }).then((response) => assert.equal(response.status, 200));
  const moderationNotifications = await request('/users/me/notifications?unread=true', { cookie: owner.cookie });
  assert.equal(moderationNotifications.status, 200);
  assert.equal(moderationNotifications.body.notifications.length, 2);
  assert.deepEqual(new Set(moderationNotifications.body.notifications.map((item) => item.type)), new Set(['project_rejected', 'project_approved']));
  const foreignNotificationUpdate = await request(`/users/me/notifications/${moderationNotifications.body.notifications[0].id}`, {
    method: 'PATCH',
    cookie: reviewer.cookie,
    body: { isRead: true },
  });
  assert.equal(foreignNotificationUpdate.status, 404);
  const markAllNotificationsRead = await request('/users/me/notifications/read-all', {
    method: 'PATCH',
    cookie: owner.cookie,
  });
  assert.equal(markAllNotificationsRead.status, 200);
  assert.equal((await request('/users/me/notifications?unread=true', { cookie: owner.cookie })).body.unreadCount, 0);
  const discovered = await request('/projects');
  assert.ok(discovered.body.projects.some((project) => project.id === projectId));
  const updatedAtBeforeView = db.prepare('SELECT updated_at FROM projects WHERE id = ?').get(projectId).updated_at;
  const publicProject = await request(`/projects/${projectId}`);
  assert.equal(publicProject.status, 200);
  assert.equal(db.prepare('SELECT views FROM projects WHERE id = ?').get(projectId).views, 1);
  assert.equal(db.prepare('SELECT updated_at FROM projects WHERE id = ?').get(projectId).updated_at, updatedAtBeforeView);
  assert.equal(publicProject.body.project.owner.name, 'Updated Project Owner');
  assert.equal(Array.isArray(publicProject.body.project.ownerProjects), true);
  assert.equal(Object.hasOwn(publicProject.body.project, 'sourceCode'), false);
  assert.equal(Object.hasOwn(publicProject.body.project, 'sourceFilename'), false);
  const sortedProjects = await request('/projects?sort=rating&page=1&limit=1');
  assert.equal(sortedProjects.body.projects.length, 1);
  assert.equal(sortedProjects.body.page, 1);
  assert.equal(typeof sortedProjects.body.total, 'number');
  const publicCreator = await request(`/users/${owner.user.id}`);
  assert.equal(publicCreator.status, 200);
  assert.equal(publicCreator.body.user.name, 'Updated Project Owner');
  assert.equal(publicCreator.body.user.websiteUrl, 'https://project-owner.example.test');
  assert.equal(Object.hasOwn(publicCreator.body.user, 'email'), false);
  const publicCreatorProjects = await request(`/projects?ownerId=${encodeURIComponent(owner.user.id)}`);
  assert.ok(publicCreatorProjects.body.projects.some((project) => project.id === projectId));
  const projectFilters = await request('/projects/filters');
  assert.ok(projectFilters.body.categories.includes('Developer Tools'));
  assert.ok(projectFilters.body.technologies.includes('SQLite'));
  const technologyFiltered = await request('/projects?technology=SQLite');
  assert.ok(technologyFiltered.body.projects.some((project) => project.id === projectId));
  const noTechnologyResults = await request('/projects?technology=UnknownTechnology');
  assert.equal(noTechnologyResults.body.total, 0);
  const popularProjects = await request('/projects?sort=popular');
  assert.ok(popularProjects.body.projects.some((project) => project.id === projectId));

  const selfReport = await request(`/projects/${projectId}/reports`, {
    method: 'POST',
    cookie: owner.cookie,
    body: { reason: 'other', details: 'Owner cannot report this.' },
  });
  assert.equal(selfReport.status, 403);
  const reportSubmission = await request(`/projects/${projectId}/reports`, {
    method: 'POST',
    cookie: reviewer.cookie,
    body: { reason: 'misleading', details: 'The demo link does not match the project description.' },
  });
  assert.equal(reportSubmission.status, 201);
  assert.equal((await request(`/projects/${projectId}/reports`, {
    method: 'POST',
    cookie: reviewer.cookie,
    body: { reason: 'spam', details: '' },
  })).status, 409);
  assert.equal((await request('/admin/reports?status=open', { cookie: reviewer.cookie })).status, 403);
  const reportQueue = await request('/admin/reports?status=open', { cookie: adminLogin.cookie });
  assert.equal(reportQueue.status, 200);
  assert.equal(reportQueue.body.reports.length, 1);
  const reportId = reportQueue.body.reports[0].id;
  const reportResolution = await request(`/admin/reports/${reportId}`, {
    method: 'PATCH',
    cookie: adminLogin.cookie,
    body: { status: 'dismissed', resolution: 'Reviewed the report; no policy violation found.' },
  });
  assert.equal(reportResolution.status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM admin_audit_events WHERE target_type = 'report' AND target_id = ?").get(reportId).count, 1);

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
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM user_notifications WHERE user_id = ? AND type = 'new_review'").get(owner.user.id).count, 1);
  const reviewNotification = await request('/users/me/notifications?unread=true', { cookie: owner.cookie });
  assert.equal(reviewNotification.body.notifications.length, 1);
  assert.equal(reviewNotification.body.notifications[0].type, 'new_review');

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
  const adminReviews = await request('/admin/reviews', { cookie: adminLogin.cookie });
  assert.equal(adminReviews.status, 200);
  assert.equal(adminReviews.body.reviews.length, 1);
  assert.equal(adminReviews.body.reviews[0].reviewerEmail, 'reviewer@example.test');
  assert.equal(adminReviews.body.reviews[0].rating, 3);

  const dashboard = await request('/projects/dashboard', { cookie: owner.cookie });
  assert.equal(dashboard.body.stats.totalReviews, 1);
  assert.equal(dashboard.body.stats.averageRating, 3);
  const moderationHistory = await request('/admin/history', { cookie: adminLogin.cookie });
  assert.equal(moderationHistory.body.history.length, 2);

  const privateFeedback = await request('/admin/history', { cookie: reviewer.cookie });
  assert.equal(privateFeedback.status, 403);

  const resetToken = 'single-use-reset-token-for-integration';
  db.prepare('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').run(
    'reset-token-test',
    owner.user.id,
    createHash('sha256').update(resetToken).digest('hex'),
    new Date(Date.now() + 10 * 60 * 1000).toISOString()
  );
  const passwordReset = await request('/auth/reset-password', {
    method: 'POST',
    body: { token: resetToken, password: 'owner-reset-password-456' },
  });
  assert.equal(passwordReset.status, 200);
  assert.equal((await request('/users/me/bookmarks', { cookie: owner.cookie })).status, 401);
  assert.equal((await request('/auth/login', {
    method: 'POST',
    body: { email: 'owner@example.test', password: 'secure-password-123' },
  })).status, 401);
  assert.equal((await request('/auth/login', {
    method: 'POST',
    body: { email: 'owner@example.test', password: 'owner-reset-password-456' },
  })).status, 200);
  assert.equal((await request('/auth/reset-password', {
    method: 'POST',
    body: { token: resetToken, password: 'another-owner-password-789' },
  })).status, 400);

  const wrongAdminPassword = await request('/admin/password', {
    method: 'PUT',
    cookie: adminLogin.cookie,
    body: { currentPassword: 'wrong-password', newPassword: 'a-new-secure-password-123' },
  });
  assert.equal(wrongAdminPassword.status, 401);
  const changedAdminPassword = await request('/admin/password', {
    method: 'PUT',
    cookie: adminLogin.cookie,
    body: { currentPassword: 'secure-password-123', newPassword: 'a-new-secure-password-123' },
  });
  assert.equal(changedAdminPassword.status, 200);
  const revokedAdminSession = await request('/admin/profile', { cookie: admin.cookie });
  assert.equal(revokedAdminSession.status, 401);
  const updatedAdminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.test', password: 'a-new-secure-password-123' },
  });
  assert.equal(updatedAdminLogin.status, 200);
  assert.equal(updatedAdminLogin.body.user.role, 'admin');

  const selfSuspend = await request(`/admin/users/${admin.user.id}/status`, {
    method: 'PATCH',
    cookie: updatedAdminLogin.cookie,
    body: { accountStatus: 'suspended' },
  });
  assert.equal(selfSuspend.status, 409);
  const suspendReviewer = await request(`/admin/users/${reviewer.user.id}/status`, {
    method: 'PATCH',
    cookie: updatedAdminLogin.cookie,
    body: { accountStatus: 'suspended' },
  });
  assert.equal(suspendReviewer.status, 200);
  assert.equal(suspendReviewer.body.accountStatus, 'suspended');
  assert.equal((await request('/users/me/bookmarks', { cookie: reviewer.cookie })).status, 401);
  assert.equal((await request('/auth/login', {
    method: 'POST',
    body: { email: 'reviewer@example.test', password: 'secure-password-123' },
  })).status, 403);
  const reactivateReviewer = await request(`/admin/users/${reviewer.user.id}/status`, {
    method: 'PATCH',
    cookie: updatedAdminLogin.cookie,
    body: { accountStatus: 'active' },
  });
  assert.equal(reactivateReviewer.status, 200);
  const reviewerAfterReactivation = await request('/auth/login', {
    method: 'POST',
    body: { email: 'reviewer@example.test', password: 'secure-password-123' },
  });
  assert.equal(reviewerAfterReactivation.status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM admin_audit_events WHERE target_id = ? AND action IN ('user_suspended', 'user_reactivated')").get(reviewer.user.id).count, 2);

  const failureResponse = await request('/projects/not-a-project/reviews', {
    method: 'POST',
    cookie: reviewerAfterReactivation.cookie,
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

test('development admin setup creates an administrator with a password hash and refuses production', (context) => {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'projectsphere-admin-'));
  const databasePath = path.join(temporaryDirectory, 'admin.sqlite');
  context.after(() => rmSync(temporaryDirectory, { recursive: true, force: true }));
  const childEnv = {
    ...process.env,
    SQLITE_DB_PATH: databasePath,
    JWT_SECRET: 'projectsphere-admin-setup-test-secret',
    ADMIN_EMAIL: 'admin-seed@example.test',
    ADMIN_PASSWORD: 'development-test-password',
  };
  const setup = spawnSync(process.execPath, ['scripts/setup-development-admin.js'], {
    cwd: backendDirectory,
    env: { ...childEnv, NODE_ENV: 'development' },
    encoding: 'utf8',
  });
  assert.equal(setup.status, 0, setup.stderr);
  assert.match(setup.stdout, /Created the development administrator account admin-seed@example\.test/);

  const verify = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { db } from './src/config/db.js';
    import { verifyPassword } from './src/services/authService.js';
    const user = db.prepare('SELECT role, password_hash FROM users WHERE email = ?').get('admin-seed@example.test');
    if (!user || user.role !== 'admin' || user.password_hash === 'development-test-password' || !(await verifyPassword('development-test-password', user.password_hash))) process.exitCode = 1;
    db.close();
  `], {
    cwd: backendDirectory,
    env: { ...childEnv, NODE_ENV: 'development' },
    encoding: 'utf8',
  });
  assert.equal(verify.status, 0, verify.stderr);

  const productionSetup = spawnSync(process.execPath, ['scripts/setup-development-admin.js'], {
    cwd: backendDirectory,
    env: { ...childEnv, NODE_ENV: 'production' },
    encoding: 'utf8',
  });
  assert.notEqual(productionSetup.status, 0);
  assert.match(productionSetup.stderr, /disabled in production/i);
});

test('SQLite upgrades an existing schema version without resetting its records', (context) => {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'projectsphere-migration-'));
  const databasePath = path.join(temporaryDirectory, 'legacy.sqlite');
  context.after(() => rmSync(temporaryDirectory, { recursive: true, force: true }));
  const legacyDb = new Database(databasePath);
  legacyDb.exec(readFileSync(path.join(backendDirectory, 'migrations', 'sqlite', '001_initial.sql'), 'utf8'));
  legacyDb.prepare(
    'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
  ).run('legacy-admin', 'Legacy Admin', 'legacy-admin@example.test', 'existing-hash');
  legacyDb.pragma('user_version = 1');
  legacyDb.close();

  const upgrade = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { db } from './src/config/db.js';
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get('legacy-admin');
    const contactReadColumn = db.pragma('table_info(contact_messages)').some((column) => column.name === 'is_read');
    const sourceTable = db.prepare(\"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'project_source_code'\").get();
    const accountStatusColumn = db.pragma('table_info(users)').some((column) => column.name === 'account_status');
    const notificationsTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_notifications'").get();
    const preferencesTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_preferences'").get();
    if (db.pragma('user_version', { simple: true }) !== 6 || user?.name !== 'Legacy Admin' || !contactReadColumn || !sourceTable || !accountStatusColumn || !notificationsTable || !preferencesTable) process.exitCode = 1;
    db.close();
  `], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SQLITE_DB_PATH: databasePath,
      JWT_SECRET: 'projectsphere-migration-test-secret',
    },
    encoding: 'utf8',
  });
  assert.equal(upgrade.status, 0, upgrade.stderr);
});
