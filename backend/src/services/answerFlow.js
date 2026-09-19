import { pool } from '../db/pool.js';
import { MODES } from '../lib/modes.js';
import { computeScore } from '../lib/scoring.js';
import { getAllQuestions } from '../repo/questions.js';
import { getServedQuestionIds, pickNextQuestion } from './sessionQuestions.js';
import { invalidateLeaderboardCache } from '../lib/leaderboardCache.js';
import { evaluateAchievements } from './achievements.js';
import { recordActivity } from './activity.js';
import { getOpponentSession, maybeFinishDuel } from './duels.js';
import { sendToUser } from '../lib/wsServer.js';
import { SKIP, applyLifelineToScore } from '../lib/lifelines.js';

// A question's clock starts when the player is handed the question (POST /:id/answer no
// longer pre-serves the next one), but the handover itself still costs a round trip and a
// page-turn animation before the choices are usable. This much slack keeps an answer that
// was on time on the player's own dial from being scored as a timeout. It only widens the
// timeout test — the speed bonus already clamps at zero remaining time.
export const TIMEOUT_GRACE_MS = 1500;

/**
 * Scores one answer and writes it down: the question's row, and the session's.
 *
 * Everything the player is waiting on is settled by the time this returns, which is what lets
 * the route answer them before the bookkeeping below runs. Separated from the route because
 * this is the scoring rule of the game, not an HTTP concern — and because a 199-line route
 * handler was hiding it.
 */
export async function recordAnswer({ session, servedQuestion, chosenIndex, isSkip }) {
  const modeConfig = MODES[session.mode];
  const issuedAt = new Date(servedQuestion.issued_at);
  const timingReference = modeConfig.timingMode === 'session_total' ? new Date(session.created_at) : issuedAt;
  const elapsedMs = Date.now() - timingReference.getTime();

  // A skip is never a timeout and never correct. It is the player declining to answer,
  // which is a different thing from failing to.
  const timedOut = !isSkip && elapsedMs > session.time_limit_ms + TIMEOUT_GRACE_MS;
  const correct = !isSkip && !timedOut && chosenIndex === servedQuestion.correct_choice_index;

  const questions = await getAllQuestions();
  const questionMeta = questions.find((q) => q.id === servedQuestion.question_id);

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
    [isSkip ? null : chosenIndex, isSkip ? null : correct, timedOut, points, elapsedMs,
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

  return {
    correct,
    timedOut,
    points,
    newTotalScore,
    streakAfter,
    newStrikes,
    sessionComplete,
    appliedLifeline,
    questionMeta,
    updatedSession: updatedRows[0],
  };
}

/**
 * Everything the player's answer does not depend on: achievements, the personal-best activity
 * entry, duel messaging.
 *
 * Called AFTER the response has gone out, and it matters. This used to run before it, which
 * meant a throw anywhere in here returned 500 for an answer that was already written and a
 * session already marked completed — the player was told their answer failed, and every retry
 * then got 409 because the run was over. That is the bug this ordering exists to prevent, so
 * this never throws at its caller. Achievements recompute their aggregates from scratch on the
 * next completion, so a miss here heals itself rather than being lost.
 */
export async function runPostAnswerBookkeeping({ session, outcome }) {
  const { correct, points, newTotalScore, streakAfter, sessionComplete } = outcome;
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
  } catch (err) {
    console.error('post-answer bookkeeping failed for session', session.id, err);
  }
}
