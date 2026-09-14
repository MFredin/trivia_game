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
import { pickNextQuestion, serveQuestion, getServedQuestionIds } from '../services/sessionQuestions.js';
import { requireAuth } from '../middleware/auth.js';
import { sendToUser } from '../lib/wsServer.js';
import { getOpponentSession, maybeFinishDuel } from '../services/duels.js';
import { evaluateAchievements } from '../services/achievements.js';

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

router.post('/:id/answer', async (req, res) => {
  try {
    const { question_id, chosen_index, token } = req.body ?? {};
    if (!question_id || typeof chosen_index !== 'number' || !token) {
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
    const valid = verifyQuestionToken({ sessionId: session.id, questionId: question_id, issuedAt, token });
    if (!valid) return res.status(400).json({ error: 'token_invalid' });

    const modeConfig = MODES[session.mode];
    const timingReference =
      modeConfig.timingMode === 'session_total' ? new Date(session.created_at) : issuedAt;
    const elapsedMs = Date.now() - timingReference.getTime();
    const timedOut = elapsedMs > session.time_limit_ms;
    const correct = !timedOut && chosen_index === servedQuestion.correct_choice_index;

    const questions = await getAllQuestions();
    const questionMeta = questions.find((q) => q.id === question_id);

    const { points, streakAfter } = computeScore({
      correct,
      elapsedMs,
      timeLimitMs: session.time_limit_ms,
      obscurityTier: questionMeta.obscurity_tier,
      designTier: questionMeta.design_tier,
      divergence: questionMeta.divergence,
      streakBefore: session.streak,
    });

    await pool.query(
      `UPDATE session_questions
       SET answered_at = now(), chosen_index = $1, correct = $2, timed_out = $3, points = $4, elapsed_ms = $5
       WHERE id = $6`,
      [chosen_index, correct, timedOut, points, elapsedMs, servedQuestion.id],
    );

    const newTotalScore = session.total_score + points;
    const newStrikes = correct ? session.strikes : session.strikes + 1;
    const nextPosition = servedQuestion.position + 1;
    const reachedQuestionCap = nextPosition >= session.question_count;
    const reachedStrikeLimit = modeConfig.maxStrikes != null && newStrikes >= modeConfig.maxStrikes;
    const sessionBudgetExhausted = modeConfig.timingMode === 'session_total' && timedOut;
    const isLastQuestion = reachedQuestionCap || reachedStrikeLimit || sessionBudgetExhausted;

    let nextQuestionPayload = null;
    if (!isLastQuestion) {
      const excludeIds = await getServedQuestionIds(session.id);
      const nextQuestion = pickNextQuestion({ session, questions, position: nextPosition, excludeIds });
      if (nextQuestion) {
        const served = await serveQuestion({ session, question: nextQuestion, position: nextPosition });
        nextQuestionPayload = served;
      }
    }

    const sessionComplete = isLastQuestion || !nextQuestionPayload;
    const newBestStreak = Math.max(session.best_streak, streakAfter);

    const { rows: updatedRows } = await pool.query(
      `UPDATE game_sessions
       SET streak = $1, strikes = $2, total_score = $3, status = $4, completed_at = $5, best_streak = $6
       WHERE id = $7
       RETURNING *`,
      [
        streakAfter,
        newStrikes,
        newTotalScore,
        sessionComplete ? 'completed' : 'active',
        sessionComplete ? new Date() : null,
        newBestStreak,
        session.id,
      ],
    );
    const updatedSession = updatedRows[0];
    if (sessionComplete) {
      invalidateLeaderboardCache();
      await evaluateAchievements(session.user_id);
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

    return res.json({
      correct,
      timed_out: timedOut,
      points,
      running_total: newTotalScore,
      streak: streakAfter,
      strikes: newStrikes,
      correct_answer: questionMeta.correct_answer,
      explanation: questionMeta.explanation,
      session_complete: sessionComplete,
      next: nextQuestionPayload
        ? { question: nextQuestionPayload.question, token: nextQuestionPayload.token, issued_at: nextQuestionPayload.issued_at }
        : null,
      session: sessionSummary(updatedSession),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
