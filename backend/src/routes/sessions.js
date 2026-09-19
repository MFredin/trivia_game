import express from 'express';
import { pool } from '../db/pool.js';
import { getAllQuestions } from '../repo/questions.js';
import { MODES } from '../lib/modes.js';
import { OBSCURITY_TIERS } from '../lib/difficultyTiers.js';
import { dailyKeyFor } from '../lib/questionSelection.js';
import { currentLeaderboardWindow } from '../lib/leaderboardWindow.js';
import { verifyQuestionToken } from '../lib/tokens.js';
import { computeScore } from '../lib/scoring.js';
import { invalidateLeaderboardCache } from '../lib/leaderboardCache.js';
import {
  pickNextQuestion,
  serveQuestion,
  getServedQuestionIds,
  getPendingQuestion,
  servedQuestionCount,
} from '../services/sessionQuestions.js';
import { requireAuth } from '../middleware/auth.js';
import { sendToUser } from '../lib/wsServer.js';
import { getOpponentSession, maybeFinishDuel } from '../services/duels.js';
import { evaluateAchievements } from '../services/achievements.js';
import { recordActivity } from '../services/activity.js';
import {
  FIFTY_FIFTY,
  SKIP,
  LIFELINE_MODES,
  lifelineAvailable,
  applyLifelineToScore,
  fiftyFiftyHiddenIndices,
} from '../lib/lifelines.js';

const router = express.Router();

// A question's clock starts when the player is handed the question (POST /:id/answer no
// longer pre-serves the next one), but the handover itself still costs a round trip and a
// page-turn animation before the choices are usable. This much slack keeps an answer that
// was on time on the player's own dial from being scored as a timeout. It only widens the
// timeout test — the speed bonus already clamps at zero remaining time.
const TIMEOUT_GRACE_MS = 1500;

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

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM game_sessions WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'session_not_found' });
  return res.json(sessionSummary(rows[0]));
});

// Hands the player their next question and starts its clock. Called when they dismiss a
// result, not when they submit the answer before it, so time spent reading an explanation
// is never charged to the question that follows.
//
// Idempotent on purpose: if this session already has a served, unanswered question it comes
// back unchanged, keeping its original issued_at. That makes the call safe to retry after a
// dropped response without handing out a fresh 20 seconds.
router.post('/:id/next', async (req, res) => {
  try {
    const { rows: sessionRows } = await pool.query('SELECT * FROM game_sessions WHERE id = $1', [req.params.id]);
    const session = sessionRows[0];
    if (!session) return res.status(404).json({ error: 'session_not_found' });
    if (session.status !== 'active') return res.status(409).json({ error: 'session_not_active' });

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
router.post('/:id/lifeline', async (req, res) => {
  try {
    const { question_id, token, type } = req.body ?? {};
    if (!question_id || !token || type !== FIFTY_FIFTY) {
      return res.status(400).json({ error: 'invalid_request' });
    }

    const { rows: sessionRows } = await pool.query('SELECT * FROM game_sessions WHERE id = $1', [req.params.id]);
    const session = sessionRows[0];
    if (!session) return res.status(404).json({ error: 'session_not_found' });
    if (session.status !== 'active') return res.status(409).json({ error: 'session_not_active' });

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

router.post('/:id/answer', async (req, res) => {
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

    const { rows: sessionRows } = await pool.query('SELECT * FROM game_sessions WHERE id = $1', [req.params.id]);
    const session = sessionRows[0];
    if (!session) return res.status(404).json({ error: 'session_not_found' });
    if (session.status !== 'active') return res.status(409).json({ error: 'session_not_active' });

    const { rows: sqRows } = await pool.query(
      'SELECT * FROM session_questions WHERE session_id = $1 AND question_id = $2',
      [session.id, question_id],
    );
    const servedQuestion = sqRows[0];
    if (!servedQuestion) return res.status(400).json({ error: 'unknown_question' });
    if (servedQuestion.answered_at) return res.status(409).json({ error: 'already_answered' });

    const issuedAt = new Date(servedQuestion.issued_at);
    const valid = verifyQuestionToken({ sessionId: session.id, questionId: question_id, issuedAt, token });
    if (!valid) return res.status(400).json({ error: 'token_invalid' });

    if (isSkip && !lifelineAvailable(session, SKIP)) {
      return res.status(409).json({ error: 'lifeline_unavailable' });
    }

    const modeConfig = MODES[session.mode];
    const timingReference =
      modeConfig.timingMode === 'session_total' ? new Date(session.created_at) : issuedAt;
    const elapsedMs = Date.now() - timingReference.getTime();
    // A skip is never a timeout and never correct. It is the player declining to answer,
    // which is a different thing from failing to.
    const timedOut = !isSkip && elapsedMs > session.time_limit_ms + TIMEOUT_GRACE_MS;
    const correct = !isSkip && !timedOut && chosen_index === servedQuestion.correct_choice_index;

    const questions = await getAllQuestions();
    const questionMeta = questions.find((q) => q.id === question_id);

    const scored = computeScore({
      correct,
      elapsedMs,
      timeLimitMs: session.time_limit_ms,
      obscurityTier: questionMeta.obscurity_tier,
      designTier: questionMeta.design_tier,
      divergence: questionMeta.divergence,
      streakBefore: session.streak,
    });

    // A question already 50-50'd scores half; a skipped one scores nothing. The lifeline is
    // read off the served row, not the request, so the discount cannot be declined.
    const appliedLifeline = isSkip ? SKIP : servedQuestion.lifeline;
    const points = applyLifelineToScore(scored.points, appliedLifeline);
    // Preserving the streak is the entire value of a skip. Declining to answer is not the
    // same as getting it wrong, so the run's momentum survives it.
    const streakAfter = isSkip ? session.streak : scored.streakAfter;

    await pool.query(
      `UPDATE session_questions
       SET answered_at = now(), chosen_index = $1, correct = $2, timed_out = $3, points = $4, elapsed_ms = $5,
           lifeline = COALESCE($6, lifeline)
       WHERE id = $7`,
      [isSkip ? null : chosen_index, isSkip ? null : correct, timedOut, points, elapsedMs,
       isSkip ? SKIP : null, servedQuestion.id],
    );

    const newTotalScore = session.total_score + points;
    // A skip costs no strike either — spending the lifeline is the cost.
    const newStrikes = correct || isSkip ? session.strikes : session.strikes + 1;
    const nextPosition = servedQuestion.position + 1;
    const reachedQuestionCap = nextPosition >= session.question_count;
    const reachedStrikeLimit = modeConfig.maxStrikes != null && newStrikes >= modeConfig.maxStrikes;
    const sessionBudgetExhausted = modeConfig.timingMode === 'session_total' && timedOut;
    const isLastQuestion = reachedQuestionCap || reachedStrikeLimit || sessionBudgetExhausted;

    // Deliberately only ASKS whether another question exists — it is POST /:id/next that
    // actually serves one, when the player dismisses this result and is ready to read it.
    // Serving here instead would start the next question's clock now, and every second the
    // player spent reading this explanation would come out of it (see docs/answer-flow.md).
    let nextAvailable = false;
    if (!isLastQuestion) {
      const excludeIds = await getServedQuestionIds(session.id);
      nextAvailable = Boolean(pickNextQuestion({ session, questions, position: nextPosition, excludeIds }));
    }

    const sessionComplete = isLastQuestion || !nextAvailable;
    const newBestStreak = Math.max(session.best_streak, streakAfter);

    const { rows: updatedRows } = await pool.query(
      `UPDATE game_sessions
       SET streak = $1, strikes = $2, total_score = $3, status = $4, completed_at = $5, best_streak = $6,
           lifelines_used = CASE WHEN $7::text IS NULL THEN lifelines_used
                                 ELSE array_append(lifelines_used, $7::text) END
       WHERE id = $8
       RETURNING *`,
      [
        streakAfter,
        newStrikes,
        newTotalScore,
        sessionComplete ? 'completed' : 'active',
        sessionComplete ? new Date() : null,
        newBestStreak,
        // Spent in the same statement that records the answer, so a skip cannot be counted
        // twice by a retry: the question is already answered by then and the route refuses.
        isSkip ? SKIP : null,
        session.id,
      ],
    );
    const updatedSession = updatedRows[0];

    // The answer is recorded and the session's own row is up to date — everything the player
    // is waiting on is settled, so answer them now.
    res.json({
      correct,
      timed_out: timedOut,
      skipped: isSkip,
      points,
      running_total: newTotalScore,
      streak: streakAfter,
      strikes: newStrikes,
      correct_answer: questionMeta.correct_answer,
      explanation: questionMeta.explanation,
      session_complete: sessionComplete,
      lifeline: appliedLifeline ?? null,
      session: sessionSummary(updatedSession),
    });

    // Everything past this point is bookkeeping the player's answer does not depend on:
    // achievements, the personal-best activity entry, duel messaging. It used to run BEFORE
    // the response, which meant a throw in any of it returned 500 for an answer that was
    // already written and a session already marked completed — the player was told their
    // answer failed, and every retry then got 409 because the run was over. That is the
    // failure this ordering exists to prevent, so it gets its own catch and never reaches
    // the handler's. Achievements recompute their aggregates from scratch on the next
    // completion, so a miss here heals itself rather than being lost.
    try {
      if (sessionComplete) {
        invalidateLeaderboardCache();
        await evaluateAchievements(session.user_id);

        // Simplified on purpose: an all-time personal best across ANY mode/filter, not a true
        // per-segment "best at this category+tier" check (that would mean replaying the
        // leaderboard's own segmentation logic on every completion) — see
        // docs/phase5-scaffold.md §2.
        const { rows: bestRows } = await pool.query(
          `SELECT max(total_score) AS prev_best FROM game_sessions WHERE user_id = $1 AND status = 'completed' AND id != $2`,
          [session.user_id, session.id],
        );
        const prevBest = Number(bestRows[0].prev_best ?? 0);
        if (newTotalScore > prevBest) {
          await recordActivity(session.user_id, 'personal_best', { mode: session.mode, total_score: newTotalScore });
        }

        // social_challenge_group checks the challenge CREATOR's stats, not the player who just
        // finished it — so a completion by anyone else needs to re-evaluate the creator too.
        if (session.challenge_id) {
          const { rows: challengeRows } = await pool.query('SELECT created_by FROM challenges WHERE id = $1', [
            session.challenge_id,
          ]);
          const creatorId = challengeRows[0]?.created_by;
          if (creatorId && creatorId !== session.user_id) {
            await evaluateAchievements(creatorId);
          }
        }
      }

      if (session.duel_id) {
        const opponentSession = await getOpponentSession(session.duel_id, session.user_id);
        if (opponentSession) {
          sendToUser(opponentSession.user_id, {
            type: 'duel:opponent_progress',
            duel_id: session.duel_id,
            correct,
            points,
            running_total: newTotalScore,
            streak: streakAfter,
            session_complete: sessionComplete,
          });
        }
        if (sessionComplete) {
          await maybeFinishDuel(session.duel_id);
        }
      }
    } catch (bookkeepingErr) {
      console.error('post-answer bookkeeping failed for session', session.id, bookkeepingErr);
    }
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
