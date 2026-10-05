import crypto from 'node:crypto';
import 'dotenv/config';

const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

if (!AUTH_TOKEN_SECRET) {
  throw new Error('AUTH_TOKEN_SECRET must be set');
}

// `version` is users.token_version at the time of signing. A token is good only while it matches the account's
// current number (see repo/users.js getAccountAccess), which is how a password change ends other sessions.
export function signAuthToken(userId, version = 0) {
  const payload = { user_id: userId, issued_at: Date.now(), v: version };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_TOKEN_SECRET).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
}

export function verifyAuthToken(token) {
  return readAuthToken(token)?.userId ?? null;
}

/** Who a token says it is for, and which generation it belongs to; null if it is forged, malformed or old. */
export function readAuthToken(token) {
  if (typeof token !== 'string') return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = crypto.createHmac('sha256', AUTH_TOKEN_SECRET).update(encoded).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const gotBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== gotBuf.length || !crypto.timingSafeEqual(expectedBuf, gotBuf)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }

  if (typeof payload.user_id !== 'number' || Date.now() - payload.issued_at > MAX_AGE_MS) {
    return null;
  }
  // A token from before versions existed has no `v`, and is generation 0.
  return { userId: payload.user_id, version: Number.isInteger(payload.v) ? payload.v : 0 };
}
