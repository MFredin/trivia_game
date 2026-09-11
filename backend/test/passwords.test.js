import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/lib/passwords.js';

test('a password verifies against its own hash', () => {
  const hash = hashPassword('correct-horse-battery-staple');
  assert.equal(verifyPassword('correct-horse-battery-staple', hash), true);
});

test('the wrong password is rejected', () => {
  const hash = hashPassword('correct-horse-battery-staple');
  assert.equal(verifyPassword('wrong-password', hash), false);
});

test('two hashes of the same password are not identical (salted)', () => {
  const a = hashPassword('same-password');
  const b = hashPassword('same-password');
  assert.notEqual(a, b);
  assert.equal(verifyPassword('same-password', a), true);
  assert.equal(verifyPassword('same-password', b), true);
});
