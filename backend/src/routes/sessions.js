import express from 'express';
import { pool } from '../db/pool.js';
import { getAllQuestions } from '../repo/questions.js';
import { MODES } from '../lib/modes.js';
import { OBSCURITY_TIERS } from '../lib/difficultyTiers.js';
import { dailyKeyFor } from '../lib/questionSelection.js';
import { currentLeaderboardWindow } from '../lib/leaderboardWindow.js';
import { verifyQuestionToken } from '../lib/tokens.js';
import {
  pickNextQuestion,
  serveQuestion,
  getServedQuestionIds,
  getPendingQuestion,
  servedQuestionCount,
} from '../services/sessionQuestions.js';
import { requireAuth } from '../middleware/auth.js';
import { FIFTY_FIFTY, SKIP, LIFELINE_MODES, lifelineAvailable, fiftyFiftyHiddenIndices } from '../lib/lifelines.js';
import { recordAnswer, runPostAnswerBookkeeping } from '../services/answerFlow.js';

const router = express.Router();

function sessionSummary(session) {
  const modeConfig = MODES[session.mode];
  return {
    session_id: session.id,
    mode: session.mode,
    category: session.category,
    canon_source: session.canon_source,
    difficulty: session.obscurity_filter,
    question_count: session.question_count,
    time_limit_ms: session.time_limit_ms,
    timing_mode: modeConfig.timingMode,
    max_strikes: modeConfig.maxStrikes,
    created_at: session.created_at,
    status: session.status,
    streak: session.streak,
    strikes: session.strikes,
    best_streak: session.best_streak,
    total_score: session.total_score,
    lifelines_used: session.lifelines_used ?? [],
    lifelines_enabled: LIFELINE_MODES.includes(session.mode),
  };
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const { mode, category, canon_source, difficulty } = req.body ?? {};
    if (!MODES[mode]) {
      return res.status(400).json({ error: 'invalid_mode' });
    }
    const canonSource = canon_source ?? 'combined';
    if (!['books', 'movies', 'combined'].includes(canonSource)) {
      return res.status(400).json({ error: 'invalid_canon_source' });
    }
    if (difficulty && !OBSCURITY_TIERS.includes(difficulty)) {
      return res.status(400).json({ error: 'invalid_difficulty' });
    }

    const modeConfig = MODES[mode];
    const questions = await getAllQuestions();

    const isDaily = mode === 'daily';
    const dailyKey = isDaily ? dailyKeyFor() : null;
    const effectiveCategory = isDaily ? null : category ?? null;
    const effectiveCanonSource = isDaily ? 'combined' : canonSource;
    const effectiveDifficulty = isDaily ? null : difficulty ?? null;

    let session;
    try {
      const { rows } = await pool.query(
        `INSERT INTO game_sessions
          (user_id, mode, category, canon_source, obscurity_filter, question_count, time_limit_ms, daily_key, leaderboard_window)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          req.userId,
          mode,
          effectiveCategory,
          effectiveCanonSource,
          effectiveDifficulty,
          modeConfig.questionCount,
          modeConfig.timeLimitMs,
          dailyKey,
          currentLeaderboardWindow(),
        ],
      );
      session = rows[0];
    } catch (err) {
      if (err.code === '23505' && dailyKey) {
        return res.status(409).json({ error: 'daily_already_played' });
      }
      throw err;
    }

    const firstQuestion = pickNextQuestion({ session, questions, position: 0, excludeIds: new Set() });
    if (!firstQuestion) {
      return res.status(400).json({ error: 'no_eligible_questions' });
    }

    const { question, token, issued_at } = await serveQuestion({ session, question: firstQuestion, position: 0 });

    return res.status(201).json({ ...sessionSummary(session), question, token, issued_at });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Loads the run named in the URL and proves it belongs to whoever is asking.
 *
 * Every route below used to look the session up by id alone, which made the id itself the
 * only credential: anyone who learned a run's UUID could read its score, pull its next
 * question, spend its lifelines or answer on its behalf, and the resulting score would post
 * to the leaderboard under the owner's name. UUIDs are unguessable, but "unguessable" is not
 * an authorization check — the ownership test is.
 *
 * Returns the session, or null after having already sent the response.
 */
async function loadOwnedSession(req, res, { requireActive = true } = {}) {
  const { rows } = await pool.query('SELECT * FROM game_sessions WHERE id = $1', [req.params.id]);
  const session = rows[0];
  // Same 404 for "no such run" and "not yours", so the endpoint cannot be used to test
  // whether a given id exists.
  if (!session || session.user_id !== req.userId) {
    res.status(404).json({ error: 'session_not_found' });
    return null;
  }
  if (requireActive && session.status !== 'active') {
    res.status(409).json({ error: 'session_not_active' });
    return null;
  }
  return session;
}

router.get('/:id', requireAuth, async (req, res) => {
  // A finished run is still readable — this is what the client falls back to when an answer
  // response goes missing and it needs to know whether the run already ended.
  const session = await loadOwnedSession(req, res, { requireActive: false });
  if (!session) return undefined;
  return res.json(sessionSummary(session));
});

// Hands the player their next question and starts its clock. Called when they dismiss a
// result, not when they submit the answer before it, so time spent reading an explanation
// is never charged to the question that follows.
//
// Idempotent on purpose: if this session already has a served, unanswered question it comes
// back unchanged, keeping its original issued_at. That makes the call safe to retry after a
// dropped response without handing out a fresh 20 seconds.
router.post('/:id/next', requireAuth, async (req, res) => {
  try {
    const session = await loadOwnedSession(req, res);
    if (!session) return undefined;

    const questions = await getAllQuestions();

    const pending = await getPendingQuestion({ session, questions });
    if (pending) return res.json(pending);

    const position = await servedQuestionCount(session.id);
    if (position >= session.question_count) return res.status(409).json({ error: 'session_not_active' });

    const excludeIds = await getServedQuestionIds(session.id);
    const nextQuestion = pickNextQuestion({ session, questions, position, excludeIds });
    if (!nextQuestion) return res.status(409).json({ error: 'no_eligible_questions' });

    const served = await serveQuestion({ session, question: nextQuestion, position });
    return res.json(served);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Spending a 50-50. Separate from answering because the player needs the result before they
// choose, and it must be the server that decides which choices vanish: the client is handed a
// shuffled list with no idea which answer is right, and that is the whole anti-cheat model.
//
// Idempotent. Asking twice returns the same two hidden choices and spends nothing further, so
// a retry after a dropped response cannot narrow the field a second time.
router.post('/:id/lifeline', requireAuth, async (req, res) => {
  try {
    const { question_id, token, type } = req.body ?? {};
    if (!question_id || !token || type !== FIFTY_FIFTY) {
      return res.status(400).json({ error: 'invalid_request' });
    }

    const session = await loadOwnedSession(req, res);
    if (!session) return undefined;

    const { rows: sqRows } = await pool.query(
      'SELECT * FROM session_questions WHERE session_id = $1 AND question_id = $2',
      [session.id, question_id],
    );
    const servedQuestion = sqRows[0];
    if (!servedQuestion) return res.status(400).json({ error: 'unknown_question' });
    if (servedQuestion.answered_at) return res.status(409).json({ error: 'already_answered' });

    const issuedAt = new Date(servedQuestion.issued_at);
    if (!verifyQuestionToken({ sessionId: session.id, questionId: question_id, issuedAt, token })) {
      return res.status(400).json({ error: 'token_invalid' });
    }

    const hidden = fiftyFiftyHiddenIndices(servedQuestion.correct_choice_index, servedQuestion.choice_order.length);

    // Already spent on this very question: hand back the same answer rather than refusing,
    // so a retry is safe.
    if (servedQuestion.lifeline === FIFTY_FIFTY) {
      return res.json({ type: FIFTY_FIFTY, hidden_indices: hidden, lifelines_used: session.lifelines_used });
    }
    if (!lifelineAvailable(session, FIFTY_FIFTY)) return res.status(409).json({ error: 'lifeline_unavailable' });

    await pool.query('UPDATE session_questions SET lifeline = $1 WHERE id = $2', [FIFTY_FIFTY, servedQuestion.id]);
    const { rows: updated } = await pool.query(
      `UPDATE game_sessions SET lifelines_used = array_append(lifelines_used, $1)
       WHERE id = $2 RETURNING lifelines_used`,
      [FIFTY_FIFTY, session.id],
    );

    return res.json({ type: FIFTY_FIFTY, hidden_indices: hidden, lifelines_used: updated[0].lifelines_used });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/:id/answer', requireAuth, async (req, res) => {
  try {
    const { question_id, chosen_index, token, lifeline } = req.body ?? {};
    if (!question_id || typeof chosen_index !== 'number' || !token) {
      return res.status(400).json({ error: 'invalid_request' });
    }
    // A skip travels through this route rather than its own, so it inherits the whole
    // flow — session completion, achievements, duel bookkeeping — instead of a parallel
    // copy of it that would drift.
    const isSkip = lifeline === SKIP;
    if (lifeline !== undefined && !isSkip) return res.status(400).json({ error: 'invalid_request' });

    const session = await loadOwnedSession(req, res);
    if (!session) return undefined;

    const { rows: sqRows } = await pool.query(
      'SELECT * FROM session_questions WHERE session_id = $1 AND question_id = $2',
      [session.id, question_id],
    );
    const servedQuestion = sqRows[0];
    if (!servedQuestion) return res.status(400).json({ error: 'unknown_question' });
    if (servedQuestion.answered_at) return res.status(409).json({ error: 'already_answered' });

    const issuedAt = new Date(servedQuestion.issued_at);
    if (!verifyQuestionToken({ sessionId: session.id, questionId: question_id, issuedAt, token })) {
      return res.status(400).json({ error: 'token_invalid' });
    }

    if (isSkip && !lifelineAvailable(session, SKIP)) {
      return res.status(409).json({ error: 'lifeline_unavailable' });
    }

    const outcome = await recordAnswer({ session, servedQuestion, chosenIndex: chosen_index, isSkip });

    // The answer is recorded and the session's own row is up to date — everything the player
    // is waiting on is settled, so answer them now, and do the bookkeeping afterwards.
    res.json({
      correct: outcome.correct,
      timed_out: outcome.timedOut,
      skipped: isSkip,
      points: outcome.points,
      running_total: outcome.newTotalScore,
      streak: outcome.streakAfter,
      strikes: outcome.newStrikes,
      correct_answer: outcome.questionMeta.correct_answer,
      explanation: outcome.questionMeta.explanation,
      session_complete: outcome.sessionComplete,
      lifeline: outcome.appliedLifeline ?? null,
      session: sessionSummary(outcome.updatedSession),
    });

    await runPostAnswerBookkeeping({ session, outcome });
    return undefined;
  } catch (err) {
    console.error(err);
    // The answer may already have been sent before this threw; a second write here would
    // only turn a served response into an ERR_HTTP_HEADERS_SENT crash.
    if (res.headersSent) return undefined;
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
