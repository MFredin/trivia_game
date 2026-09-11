import express from 'express';
import { pool } from '../db/pool.js';
import { getAllQuestions } from '../repo/questions.js';
import { MODES } from '../lib/modes.js';
import { dailyKeyFor } from '../lib/questionSelection.js';
import { verifyQuestionToken } from '../lib/tokens.js';
import { computeScore } from '../lib/scoring.js';
import { pickNextQuestion, serveQuestion, getServedQuestionIds } from '../services/sessionQuestions.js';

const router = express.Router();

async function upsertUser(username) {
  const { rows } = await pool.query(
    `INSERT INTO users (username) VALUES ($1)
     ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
     RETURNING id, username`,
    [username],
  );
  return rows[0];
}

function sessionSummary(session) {
  return {
    session_id: session.id,
    mode: session.mode,
    category: session.category,
    canon_source: session.canon_source,
    question_count: session.question_count,
    time_limit_ms: session.time_limit_ms,
    status: session.status,
    streak: session.streak,
    total_score: session.total_score,
  };
}

router.post('/', async (req, res) => {
  try {
    const { username, mode, category, canon_source } = req.body ?? {};
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ error: 'username_required' });
    }
    if (!MODES[mode]) {
      return res.status(400).json({ error: 'invalid_mode' });
    }
    const canonSource = canon_source ?? 'combined';
    if (!['books', 'movies', 'combined'].includes(canonSource)) {
      return res.status(400).json({ error: 'invalid_canon_source' });
    }

    const user = await upsertUser(username.trim());
    const modeConfig = MODES[mode];
    const questions = await getAllQuestions();

    const isDaily = mode === 'daily';
    const dailyKey = isDaily ? dailyKeyFor() : null;
    const effectiveCategory = isDaily ? null : category ?? null;
    const effectiveCanonSource = isDaily ? 'combined' : canonSource;

    let session;
    try {
      const { rows } = await pool.query(
        `INSERT INTO game_sessions
          (user_id, mode, category, canon_source, question_count, time_limit_ms, daily_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [user.id, mode, effectiveCategory, effectiveCanonSource, modeConfig.questionCount, modeConfig.timeLimitMs, dailyKey],
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

    const elapsedMs = Date.now() - issuedAt.getTime();
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
    const nextPosition = servedQuestion.position + 1;
    const isLastQuestion = nextPosition >= session.question_count;

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

    const { rows: updatedRows } = await pool.query(
      `UPDATE game_sessions
       SET streak = $1, total_score = $2, status = $3, completed_at = $4
       WHERE id = $5
       RETURNING *`,
      [
        streakAfter,
        newTotalScore,
        sessionComplete ? 'completed' : 'active',
        sessionComplete ? new Date() : null,
        session.id,
      ],
    );
    const updatedSession = updatedRows[0];

    return res.json({
      correct,
      timed_out: timedOut,
      points,
      running_total: newTotalScore,
      streak: streakAfter,
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
