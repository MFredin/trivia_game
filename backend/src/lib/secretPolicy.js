// The rules for the two signing secrets, with nothing that reads the environment at load: so a script that makes a new secret, and a test of these
// rules, can import them without the secrets being set. What loads and uses the secrets is lib/secrets.js.
//
// AUTH_TOKEN_SECRET signs every sign-in token (lib/authTokens.js), QUESTION_TOKEN_SECRET every question token (lib/tokens.js). Whoever holds the first can
// sign in as any player, an admin included; whoever holds the second can answer questions that were never served and pick the moment they were served.
// In production a secret must be long enough not to be guessed and must not look like the placeholder from .env.example, and the two must always
// differ, so that one leaking is never both. Outside production only "set and different" is asked, so a local checkout and the tests need no ceremony.

import crypto from 'node:crypto';

export const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER = /change-?me|placeholder|example|your-secret/i;

/** A fresh secret: 32 random bytes, in the URL-safe alphabet so it survives being pasted into a dashboard. */
export function generateSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

/** What is wrong with the secrets in `env`, as sentences; an empty list means they may be used. */
export function secretProblems(env = process.env) {
  const problems = [];
  const secrets = [
    ['AUTH_TOKEN_SECRET', env.AUTH_TOKEN_SECRET],
    ['QUESTION_TOKEN_SECRET', env.QUESTION_TOKEN_SECRET],
  ];
  for (const [name, value] of secrets) {
    if (!value) {
      problems.push(`${name} must be set`);
    } else if (env.NODE_ENV === 'production') {
      if (value.length < MIN_SECRET_LENGTH) problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters in production (npm run secrets:generate makes one)`);
      if (PLACEHOLDER.test(value)) problems.push(`${name} looks like a placeholder`);
    }
  }
  if (env.AUTH_TOKEN_SECRET && env.AUTH_TOKEN_SECRET === env.QUESTION_TOKEN_SECRET) problems.push('AUTH_TOKEN_SECRET and QUESTION_TOKEN_SECRET must differ');
  return problems;
}
