import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { listAdminProjects, moderateProject } from '../src/controllers/adminController.js';
import { requireAdmin } from '../src/middleware/auth.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('moderation requires actionable feedback for rejection', async (context) => {
  const getConnection = context.mock.method(pool, 'getConnection');
  const res = createResponse();
  await moderateProject({ body: { action: 'reject', feedback: '  ' }, params: { id: 'project-1' } }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /feedback is required/i);
  assert.equal(getConnection.mock.callCount(), 0);
});

test('moderation atomically records admin, transition, and feedback', async (context) => {
  const statements = [];
  let committed = false;
  let released = false;
  const connection = {
    beginTransaction: async () => {},
    execute: async (sql, params) => {
      statements.push({ sql, params });
      return sql.startsWith('SELECT') ? [[{ status: 'pending' }], []] : [{ affectedRows: 1 }, []];
    },
    commit: async () => { committed = true; },
    rollback: async () => {},
    release: () => { released = true; },
  };
  context.mock.method(pool, 'getConnection', async () => connection);
  const res = createResponse();

  await moderateProject({
    body: { action: 'request_changes', feedback: 'Please add setup instructions.' },
    params: { id: 'project-1' },
    user: { id: 'admin-1' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'changes_requested');
  assert.equal(committed, true);
  assert.equal(released, true);
  assert.deepEqual(statements[1].params, ['changes_requested', 'project-1']);
  assert.equal(statements[2].params[2], 'admin-1');
  assert.equal(statements[2].params[3], 'changes_requested');
  assert.equal(statements[2].params[4], 'pending');
  assert.equal(statements[2].params[5], 'changes_requested');
  assert.equal(statements[2].params[6], 'Please add setup instructions.');
});

test('admin authorization checks the current database role', async (context) => {
  context.mock.method(pool, 'execute', async () => [[{ role: 'developer' }], []]);
  const res = createResponse();
  let nextCalled = false;
  await requireAdmin({ user: { id: 'member-1' } }, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(nextCalled, false);
});

test('approved project filter includes published and featured projects', async (context) => {
  const statements = [];
  context.mock.method(pool, 'execute', async (sql, params) => {
    statements.push({ sql, params });
    return sql.includes('COUNT(*)') ? [[{ total: 2 }], []] : [[], []];
  });
  const res = createResponse();
  await listAdminProjects({ query: { status: 'approved', page: '1', limit: '25' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.total, 2);
  assert.match(statements[0].sql, /p\.status IN \('published', 'featured'\)/);
  assert.match(statements[1].sql, /p\.status IN \('published', 'featured'\)/);
});
