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

test('a token carries the generation it was issued under, and one with none counts as 0', async () => {
  const { readAuthToken } = await import('../src/lib/authTokens.js');
  assert.deepEqual(readAuthToken(signAuthToken(42, 3)), { userId: 42, version: 3 });
  assert.deepEqual(readAuthToken(signAuthToken(42)), { userId: 42, version: 0 });

  // A token issued before versions existed has no `v` at all; it must still be accepted as generation 0, or
  // shipping this would sign every player out.
  const crypto = await import('node:crypto');
  const encoded = Buffer.from(JSON.stringify({ user_id: 42, issued_at: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.AUTH_TOKEN_SECRET).update(encoded).digest('hex');
  assert.deepEqual(readAuthToken(`${encoded}.${sig}`), { userId: 42, version: 0 });
});
