import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_SECRET_LENGTH, generateSecret, secretProblems } from '../src/lib/secretPolicy.js';

// What the server will and will not start with. These two secrets sign every sign-in token and every question token, so a copy of either in the wrong
// hands is worth an attacker's time; the rules here keep a guessable or reused one from ever being the value that is deployed.
const strong = () => generateSecret();

test('a pair of strong, different secrets is accepted, in production too', () => {
  const env = { AUTH_TOKEN_SECRET: strong(), QUESTION_TOKEN_SECRET: strong(), NODE_ENV: 'production' };
  assert.deepEqual(secretProblems(env), []);
});

test('a missing secret is named', () => {
  assert.deepEqual(secretProblems({ QUESTION_TOKEN_SECRET: strong() }), ['AUTH_TOKEN_SECRET must be set']);
  assert.deepEqual(secretProblems({ AUTH_TOKEN_SECRET: strong() }), ['QUESTION_TOKEN_SECRET must be set']);
});

test('the two secrets must differ, whatever the environment', () => {
  const same = strong();
  for (const NODE_ENV of ['production', 'test', undefined]) {
    assert.deepEqual(secretProblems({ AUTH_TOKEN_SECRET: same, QUESTION_TOKEN_SECRET: same, NODE_ENV }), ['AUTH_TOKEN_SECRET and QUESTION_TOKEN_SECRET must differ']);
  }
});

test('in production a short secret is refused, and so is a placeholder', () => {
  const short = secretProblems({ AUTH_TOKEN_SECRET: 'x'.repeat(MIN_SECRET_LENGTH - 1), QUESTION_TOKEN_SECRET: strong(), NODE_ENV: 'production' });
  assert.equal(short.length, 1);
  assert.match(short[0], /AUTH_TOKEN_SECRET must be at least 32 characters/);

  const placeholder = secretProblems({ AUTH_TOKEN_SECRET: strong(), QUESTION_TOKEN_SECRET: 'change-me-to-a-long-random-string-that-is-long-enough', NODE_ENV: 'production' });
  assert.equal(placeholder.length, 1);
  assert.match(placeholder[0], /QUESTION_TOKEN_SECRET looks like a placeholder/);
});

test('outside production a short secret is fine, so the tests and a local checkout need no ceremony', () => {
  assert.deepEqual(secretProblems({ AUTH_TOKEN_SECRET: 'test-auth-secret', QUESTION_TOKEN_SECRET: 'test-secret', NODE_ENV: 'test' }), []);
});

test('a generated secret is long enough, URL-safe, and different every time', () => {
  const a = generateSecret();
  const b = generateSecret();
  assert.ok(a.length >= MIN_SECRET_LENGTH);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(a, b);
  assert.deepEqual(secretProblems({ AUTH_TOKEN_SECRET: a, QUESTION_TOKEN_SECRET: b, NODE_ENV: 'production' }), []);
});
