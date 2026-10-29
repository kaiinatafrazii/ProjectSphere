import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, signToken, verifyPassword, verifyToken } from '../src/services/authService.js';

test('hashPassword creates a hash that matches the original password', async () => {
  const hash = await hashPassword('secure-password');
  assert.ok(hash);
  assert.equal(await verifyPassword('secure-password', hash), true);
});

test('signToken returns a JWT string for a user payload', () => {
  const token = signToken({ id: '123', email: 'user@example.com', name: 'Ada', role: 'developer' }, 'session-123');
  assert.equal(typeof token, 'string');
  assert.ok(token.length > 20);
  assert.equal(verifyToken(token).sid, 'session-123');
});
