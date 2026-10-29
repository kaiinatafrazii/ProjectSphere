import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectInput } from '../src/utils/projectValidation.js';

const validInput = {
  title: 'A project',
  tagline: 'A concise description',
  category: 'Developer Tools',
  summary: 'A summary',
  overview: 'A longer overview',
  techStack: ['React', 'Node.js'],
  repoUrl: 'https://example.com/repo',
  liveUrl: '',
  screenshotUrl: '',
};

test('project input trims and validates supported fields', () => {
  const result = validateProjectInput({ ...validInput, title: ' A project ', techStack: [' React '] });
  assert.equal(result.error, undefined);
  assert.equal(result.data.title, 'A project');
  assert.deepEqual(result.data.techStack, ['React']);
  assert.equal(result.data.liveUrl, null);
});

test('project input rejects unsafe protocols and untrusted field types', () => {
  assert.match(validateProjectInput({ ...validInput, liveUrl: 'javascript:alert(1)' }).error, /valid HTTP or HTTPS/i);
  assert.match(validateProjectInput({ ...validInput, title: ['mass assignment'] }).error, /required project details/i);
  assert.match(validateProjectInput({ ...validInput, techStack: 'React, Node' }).error, /tech stack/i);
});
