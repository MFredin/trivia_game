import crypto from 'node:crypto';
import 'dotenv/config';

const SERVER_SECRET = process.env.QUESTION_TOKEN_SECRET;

if (!SERVER_SECRET) {
  throw new Error('QUESTION_TOKEN_SECRET must be set');
}

function hmac(sessionId, questionId, issuedAtIso) {
  return crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(`${sessionId}:${questionId}:${issuedAtIso}`)
    .digest('hex');
}

export function signQuestionToken({ sessionId, questionId, issuedAt }) {
  return hmac(sessionId, questionId, issuedAt.toISOString());
}

export function verifyQuestionToken({ sessionId, questionId, issuedAt, token }) {
  if (typeof token !== 'string' || token.length === 0) return false;
  const expected = hmac(sessionId, questionId, issuedAt.toISOString());
  const expectedBuf = Buffer.from(expected, 'hex');
  const gotBuf = Buffer.from(token, 'hex');
  if (expectedBuf.length !== gotBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, gotBuf);
}
