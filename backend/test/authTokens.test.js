import test from 'node:test';
import assert from 'node:assert/strict';
import { signAuthToken, verifyAuthToken } from '../src/lib/authTokens.js';

test('a signed token verifies back to the same user id', () => {
  const token = signAuthToken(42);
  assert.equal(verifyAuthToken(token), 42);
});

test('a tampered token is rejected', () => {
  const token = signAuthToken(42);
  const tampered = token.slice(0, -1) + (token.at(-1) === '0' ? '1' : '0');
  assert.equal(verifyAuthToken(tampered), null);
});

test('garbage input is rejected without throwing', () => {
  assert.equal(verifyAuthToken('not-a-real-token'), null);
  assert.equal(verifyAuthToken(''), null);
  assert.equal(verifyAuthToken(undefined), null);
});
