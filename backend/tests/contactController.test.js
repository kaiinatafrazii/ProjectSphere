import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { submitContactMessage } from '../src/controllers/contactController.js';

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

test('contact submission persists normalized fields and confirms acceptance', async (context) => {
  let insertedValues;
  context.mock.method(pool, 'execute', async (_query, values) => {
    insertedValues = values;
    return [{ affectedRows: 1 }, []];
  });

  const res = createResponse();
  await submitContactMessage({
    body: {
      name: ' Ada Lovelace ',
      email: ' ADA@EXAMPLE.COM ',
      subject: ' Project question ',
      message: ' Please share more details. ',
      website: '',
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { success: true, message: 'Your message has been received.' });
  assert.equal(insertedValues[1], 'Ada Lovelace');
  assert.equal(insertedValues[2], 'ada@example.com');
  assert.equal(insertedValues[3], 'Project question');
  assert.equal(insertedValues[4], 'Please share more details.');
});

test('contact submission rejects invalid input without writing to the database', async (context) => {
  const execute = context.mock.method(pool, 'execute');
  const res = createResponse();

  await submitContactMessage({
    body: { name: 'Ada', email: 'invalid-email', subject: 'Question', message: 'Hello', website: '' },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /valid email/i);
  assert.equal(execute.mock.callCount(), 0);
});

test('contact submission reports a database failure instead of confirming acceptance', async (context) => {
  context.mock.method(pool, 'execute', async () => {
    throw new Error('database unavailable');
  });
  const loggedErrors = [];
  context.mock.method(console, 'error', (...args) => loggedErrors.push(args));
  const res = createResponse();

  await submitContactMessage({
    body: { name: 'Ada', email: 'ada@example.com', subject: 'Question', message: 'Hello', website: '' },
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /could not send/i);
  assert.equal(loggedErrors.length, 1);
});
