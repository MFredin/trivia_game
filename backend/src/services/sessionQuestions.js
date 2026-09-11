import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { signQuestionToken } from '../lib/tokens.js';
import { selectQuestionSet, shuffle, mulberry32, seedFromString } from '../lib/questionSelection.js';
import { tierFloorForPosition } from '../lib/tierFloor.js';

function cryptoRng() {
  return () => crypto.randomInt(0, 1_000_000_000) / 1_000_000_000;
}

export function pickNextQuestion({ session, questions, position, excludeIds }) {
  const rng =
    session.mode === 'daily'
      ? mulberry32(seedFromString(`${session.daily_key}:${position}`))
      : cryptoRng();

  // Classic mode with no explicit difficulty filter guarantees a tier for the first few
  // positions so every run has a comparable point ceiling (see lib/tierFloor.js).
  const floorTier =
    session.mode === 'classic' && !session.obscurity_filter
      ? tierFloorForPosition(position, session.question_count)
      : null;

  const [picked] = selectQuestionSet({
    questions,
    category: session.category,
    canonSource: session.canon_source,
    obscurityTier: floorTier ?? session.obscurity_filter,
    count: 1,
    excludeIds,
    rng,
  });
  if (picked) return picked;

  // Fallback for a small category-filtered pool that's run out of the floor tier —
  // fall back to the session's normal (unconstrained-by-floor) filter instead of a dead end.
  if (floorTier) {
    const [fallback] = selectQuestionSet({
      questions,
      category: session.category,
      canonSource: session.canon_source,
      obscurityTier: session.obscurity_filter,
      count: 1,
      excludeIds,
      rng,
    });
    return fallback ?? null;
  }
  return null;
}

export function toClientQuestion(question, choiceOrder, position) {
  const options = [question.correct_answer, ...question.distractors];
  return {
    position,
    question_id: question.id,
    category: question.category,
    canon_tags: question.canon_tags,
    divergence: question.divergence,
    obscurity_tier: question.obscurity_tier,
    design_tier: question.design_tier,
    question_text: question.question_text,
    choices: choiceOrder.map((idx) => options[idx]),
  };
}

export async function serveQuestion({ session, question, position }) {
  const optionCount = 1 + question.distractors.length;
  const order = shuffle(
    Array.from({ length: optionCount }, (_, i) => i),
    cryptoRng(),
  );
  const correctChoiceIndex = order.indexOf(0);
  const issuedAt = new Date();

  await pool.query(
    `INSERT INTO session_questions
      (session_id, position, question_id, choice_order, correct_choice_index, issued_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [session.id, position, question.id, order, correctChoiceIndex, issuedAt],
  );

  const token = signQuestionToken({ sessionId: session.id, questionId: question.id, issuedAt });

  return {
    question: toClientQuestion(question, order, position),
    token,
    issued_at: issuedAt.toISOString(),
  };
}

export async function getServedQuestionIds(sessionId) {
  const { rows } = await pool.query(
    'SELECT question_id FROM session_questions WHERE session_id = $1',
    [sessionId],
  );
  return new Set(rows.map((r) => r.question_id));
}
