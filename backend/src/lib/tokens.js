// Signs and checks the token that travels with a question (anti-cheat, see docs/anti-cheat-architecture.md).
//
// When the server serves a question it hands the client a token: an HMAC over (session, question, the moment it was
// served). An answer is accepted only with a matching token, so a client cannot answer a question it was never
// served or claim a different serve time to get a bigger time bonus. (Answering the same question twice is refused
// separately: services/answerFlow.js checks that it is still unanswered.) The secret is
// QUESTION_TOKEN_SECRET, required at start-up and checked in lib/secrets.js. (Sign-in tokens are a different thing: lib/authTokens.js.)

import crypto from 'node:crypto';
import { QUESTION_TOKEN_SECRET as SERVER_SECRET } from './secrets.js';

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
