import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUser } from '../src/validate.js';

test('accepts a well-formed user', () => {
  assert.equal(validateUser({ id: 'u1', email: 'a@b.c' }), true);
});

test('rejects a user without an email', () => {
  assert.equal(validateUser({ id: 'u1' }), false);
});
