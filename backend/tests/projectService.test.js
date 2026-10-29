import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { addReviewService } from '../src/services/projectService.js';

test('reviewing a project updates the existing account rating', async (context) => {
  const statements = [];
  context.mock.method(pool, 'execute', async (sql, params) => {
    statements.push({ sql, params });
    if (sql.includes('FROM projects')) {
      return [[{ id: 'project-1', user_id: 'owner-1', status: 'published' }], []];
    }
    if (sql.includes('FROM project_reviews')) {
      return [[{ id: 'review-existing', user_id: 'reviewer-1' }], []];
    }
    return [{ affectedRows: 1 }, []];
  });

  const result = await addReviewService({
    projectId: 'project-1',
    userId: 'reviewer-1',
    rating: 4,
    comment: 'Useful project.',
  });

  assert.equal(result.id, 'review-existing');
  const insert = statements.find((entry) => entry.sql.includes('INSERT INTO project_reviews'));
  assert.match(insert.sql, /ON CONFLICT \(project_id, user_id\) DO UPDATE/);
  assert.deepEqual(insert.params.slice(1), ['project-1', 'reviewer-1', 4, 'Useful project.']);
});

test('project owners cannot review their own projects', async (context) => {
  let inserted = false;
  context.mock.method(pool, 'execute', async (sql) => {
    if (sql.includes('FROM projects')) {
      return [[{ id: 'project-1', user_id: 'owner-1', status: 'published' }], []];
    }
    if (sql.includes('INSERT INTO project_reviews')) inserted = true;
    return [[], []];
  });

  await assert.rejects(
    addReviewService({ projectId: 'project-1', userId: 'owner-1', rating: 5, comment: 'My project.' }),
    (error) => error.statusCode === 403 && /cannot review their own/i.test(error.message)
  );
  assert.equal(inserted, false);
});
