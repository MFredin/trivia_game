import express from 'express';
import crypto from 'node:crypto';
import { getAllQuestions } from '../repo/questions.js';
import { selectQuestionSet, shuffle, mulberry32, seedFromString } from '../lib/questionSelection.js';
import { signQuestionToken, verifyQuestionToken } from '../lib/tokens.js';
import { toClientQuestion } from '../services/sessionQuestions.js';
import { rateLimit } from '../lib/rateLimiter.js';

const router = express.Router();

// A stranger's first taste shouldn't be a N.E.W.T.-tier stumper — every preview question
// comes from the easiest tier only.
const PREVIEW_TIER = 'First Year';
const PREVIEW_TIME_LIMIT_MS = 20000;
const PREVIEW_QUESTION_COUNT = 5;

// Unauthenticated and hit from a "Try it now" link with no account behind it, so this is
// exactly the kind of endpoint the stack audit flagged as worth throttling.
const previewRateLimit = rateLimit({ max: 30, windowMs: 15 * 60 * 1000 });

// A preview run never writes a game_sessions/session_questions row — nothing about it
// touches leaderboards, achievements, or anti-cheat scoring state. Continuity across the
// run's handful of questions comes from re-deriving the same deterministic pick and shuffle
// from previewId+position on every call, never from anything persisted server-side.
function pickPreviewQuestion({ questions, previewId, position, excludeIds }) {
  const rng = mulberry32(seedFromString(`${previewId}:${position}`));
  const [picked] = selectQuestionSet({
    questions,
    category: null,
    canonSource: 'combined',
    obscurityTier: PREVIEW_TIER,
    count: 1,
    excludeIds,
    rng,
  });
  return picked;
}

function servePreviewQuestion({ question, previewId, position }) {
  const optionCount = 1 + question.distractors.length;
  const order = shuffle(
    Array.from({ length: optionCount }, (_, i) => i),
    mulberry32(seedFromString(`${previewId}:${question.id}:order`)),
  );
  const issuedAt = new Date();
  const token = signQuestionToken({ sessionId: previewId, questionId: question.id, issuedAt });
  return {
    question: toClientQuestion(question, order, position),
    token,
    issued_at: issuedAt.toISOString(),
  };
}

// Recomputes which questions positions 0..uptoPosition-1 picked, so the next pick can
// exclude them — the stateless equivalent of getServedQuestionIds() for a real session.
function precedingPreviewIds({ questions, previewId, uptoPosition }) {
  const seen = new Set();
  for (let position = 0; position < uptoPosition; position++) {
    const question = pickPreviewQuestion({ questions, previewId, position, excludeIds: seen });
    if (question) seen.add(question.id);
  }
  return seen;
}

router.post('/start', previewRateLimit, async (req, res) => {
  const questions = await getAllQuestions();
  const previewId = crypto.randomUUID();
  const question = pickPreviewQuestion({ questions, previewId, position: 0, excludeIds: new Set() });
  if (!question) return res.status(500).json({ error: 'no_eligible_questions' });

  const { question: clientQuestion, token, issued_at } = servePreviewQuestion({ question, previewId, position: 0 });
  return res.status(201).json({
    preview_id: previewId,
    question: clientQuestion,
    token,
    issued_at,
    question_count: PREVIEW_QUESTION_COUNT,
  });
});

router.post('/answer', previewRateLimit, async (req, res) => {
  const { preview_id, question_id, chosen_index, token, issued_at, position } = req.body ?? {};
  if (
    typeof preview_id !== 'string' ||
    typeof question_id !== 'string' ||
    typeof chosen_index !== 'number' ||
    typeof token !== 'string' ||
    typeof issued_at !== 'string' ||
    typeof position !== 'number'
  ) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  const issuedAtDate = new Date(issued_at);
  const valid = verifyQuestionToken({ sessionId: preview_id, questionId: question_id, issuedAt: issuedAtDate, token });
  if (!valid) return res.status(400).json({ error: 'token_invalid' });

  const questions = await getAllQuestions();
  const questionMeta = questions.find((q) => q.id === question_id);
  if (!questionMeta) return res.status(400).json({ error: 'unknown_question' });

  // Recompute this question's own shuffle deterministically rather than trusting anything
  // the client says about it — same reasoning as the token check above.
  const optionCount = 1 + questionMeta.distractors.length;
  const order = shuffle(
    Array.from({ length: optionCount }, (_, i) => i),
    mulberry32(seedFromString(`${preview_id}:${question_id}:order`)),
  );
  const correctChoiceIndex = order.indexOf(0);

  const timedOut = Date.now() - issuedAtDate.getTime() > PREVIEW_TIME_LIMIT_MS;
  const correct = !timedOut && chosen_index === correctChoiceIndex;

  const nextPosition = position + 1;
  let next = null;
  if (nextPosition < PREVIEW_QUESTION_COUNT) {
    const excludeIds = precedingPreviewIds({ questions, previewId: preview_id, uptoPosition: nextPosition });
    const nextQuestion = pickPreviewQuestion({ questions, previewId: preview_id, position: nextPosition, excludeIds });
    if (nextQuestion) {
      const served = servePreviewQuestion({ question: nextQuestion, previewId: preview_id, position: nextPosition });
      next = { question: served.question, token: served.token, issued_at: served.issued_at };
    }
  }

  return res.json({
    correct,
    timed_out: timedOut,
    correct_answer: questionMeta.correct_answer,
    explanation: questionMeta.explanation,
    session_complete: !next,
    next,
  });
});

export default router;
