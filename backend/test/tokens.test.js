import test from 'node:test';
import assert from 'node:assert/strict';
import { signQuestionToken, verifyQuestionToken } from '../src/lib/tokens.js';

test('a token verifies against the exact session/question/issuedAt it was signed for', () => {
  const sessionId = 'session-1';
  const questionId = 'CHR-001';
  const issuedAt = new Date();
  const token = signQuestionToken({ sessionId, questionId, issuedAt });

  assert.equal(verifyQuestionToken({ sessionId, questionId, issuedAt, token }), true);
});

test('a token does not verify for a different question (no cross-question replay)', () => {
  const sessionId = 'session-1';
  const issuedAt = new Date();
  const token = signQuestionToken({ sessionId, questionId: 'CHR-001', issuedAt });

  assert.equal(
    verifyQuestionToken({ sessionId, questionId: 'CHR-002', issuedAt, token }),
    false,
  );
});

test('a token does not verify for a different session (no cross-session replay)', () => {
  const questionId = 'CHR-001';
  const issuedAt = new Date();
  const token = signQuestionToken({ sessionId: 'session-1', questionId, issuedAt });

  assert.equal(
    verifyQuestionToken({ sessionId: 'session-2', questionId, issuedAt, token }),
    false,
  );
});

test('a tampered token is rejected', () => {
  const sessionId = 'session-1';
  const questionId = 'CHR-001';
  const issuedAt = new Date();
  const token = signQuestionToken({ sessionId, questionId, issuedAt });
  const tampered = token.slice(0, -1) + (token.at(-1) === '0' ? '1' : '0');

  assert.equal(verifyQuestionToken({ sessionId, questionId, issuedAt, token: tampered }), false);
});
