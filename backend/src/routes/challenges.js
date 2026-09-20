import express from 'express';
import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { MODES } from '../lib/modes.js';
import { OBSCURITY_TIERS } from '../lib/difficultyTiers.js';
import { currentLeaderboardWindow } from '../lib/leaderboardWindow.js';
import { getAllQuestions } from '../repo/questions.js';
import { pickNextQuestion, serveQuestion } from '../services/sessionQuestions.js';
import { evaluateAchievements } from '../services/achievements.js';
import { featuredChallengeSpec } from '../lib/featuredChallenge.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  const { category, canon_source, difficulty } = req.body ?? {};
  const canonSource = canon_source ?? 'combined';
  if (!['books', 'movies', 'combined'].includes(canonSource)) {
    return res.status(400).json({ error: 'invalid_canon_source' });
  }
  if (difficulty && !OBSCURITY_TIERS.includes(difficulty)) {
    return res.status(400).json({ error: 'invalid_difficulty' });
  }

  // Collisions are astronomically unlikely at 4 random bytes — the same tradeoff as
  // invite_code — but the unique constraint makes a retry free insurance either way.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomBytes(4).toString('hex');
    try {
      const { rows } = await pool.query(
        `INSERT INTO challenges (code, created_by, category, canon_source, obscurity_filter)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING code`,
        [code, req.userId, category ?? null, canonSource, difficulty ?? null],
      );
      await evaluateAchievements(req.userId);
      return res.status(201).json({ code: rows[0].code });
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  return res.status(500).json({ error: 'internal_error' });
});

// Registered BEFORE GET /:code, or Express would read "featured" as a challenge code.
//
// The row is created on first request for the week rather than by a scheduler: there is no
// job runner here, and a challenge nobody has asked for does not need to exist. Two players
// asking at the same moment both try to insert; the UNIQUE constraint on featured_week lets
// the loser fall back to reading the winner's row instead of erroring.
// Deliberately open: the featured challenge is the same for everyone all week and holds
// nothing personal, so there is nothing here that a login would protect.
router.get('/featured', async (req, res) => {
  try {
    const week = currentLeaderboardWindow();

    const existing = await pool.query('SELECT * FROM challenges WHERE featured_week = $1', [week]);
    if (existing.rows[0]) return res.json(await describeFeatured(existing.rows[0], week));

    const spec = featuredChallengeSpec(week, await getAllQuestions());
    if (!spec) return res.status(503).json({ error: 'no_eligible_questions' });

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = crypto.randomBytes(4).toString('hex');
      try {
        const { rows } = await pool.query(
          `INSERT INTO challenges (code, created_by, category, canon_source, obscurity_filter, featured_week)
           VALUES ($1, NULL, $2, $3, $4, $5)
           RETURNING *`,
          [code, spec.category, spec.canonSource, spec.difficulty, week],
        );
        return res.json(await describeFeatured(rows[0], week));
      } catch (err) {
        if (err.code !== '23505') throw err;
        // Either the code collided or another request just created this week's row.
        const raced = await pool.query('SELECT * FROM challenges WHERE featured_week = $1', [week]);
        if (raced.rows[0]) return res.json(await describeFeatured(raced.rows[0], week));
      }
    }
    return res.status(500).json({ error: 'internal_error' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

async function describeFeatured(challenge, week) {
  const { rows } = await pool.query(
    `SELECT count(DISTINCT user_id)::int AS players
     FROM game_sessions WHERE challenge_id = $1 AND status = 'completed'`,
    [challenge.id],
  );
  return {
    code: challenge.code,
    week,
    category: challenge.category,
    canon_source: challenge.canon_source,
    difficulty: challenge.obscurity_filter,
    players: rows[0].players,
  };
}

// Requires a login, unlike /featured above: a challenge code names one player's private
// invitation, and its only caller already sends the token. Four random bytes are not
// realistically brute-forceable over HTTP, but the code is a link to be shared, not a
// credential to be relied on.
router.get('/:code', requireAuth, async (req, res) => {
  const { rows: challengeRows } = await pool.query(
    // LEFT JOIN, not JOIN: the featured weekly challenge has no creator, and an inner join
    // would make it unreachable by its own code.
    `SELECT c.*, u.username AS created_by_username
     FROM challenges c
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.code = $1`,
    [req.params.code],
  );
  const challenge = challengeRows[0];
  if (!challenge) return res.status(404).json({ error: 'challenge_not_found' });

  // Same top-score-per-user dedup pattern the main leaderboard uses — a player who replays
  // a challenge code only counts once, at their best attempt.
  const { rows: leaderboard } = await pool.query(
    `SELECT DISTINCT ON (gs.user_id) u.username, gs.total_score, gs.completed_at
     FROM game_sessions gs
     JOIN users u ON u.id = gs.user_id
     WHERE gs.challenge_id = $1 AND gs.status = 'completed'
     ORDER BY gs.user_id, gs.total_score DESC`,
    [challenge.id],
  );
  leaderboard.sort((a, b) => b.total_score - a.total_score);

  return res.json({
    code: challenge.code,
    created_by_username: challenge.created_by_username,
    featured_week: challenge.featured_week ?? null,
    category: challenge.category,
    canon_source: challenge.canon_source,
    difficulty: challenge.obscurity_filter,
    leaderboard: leaderboard.map((r) => ({ username: r.username, total_score: r.total_score, completed_at: r.completed_at })),
  });
});

router.post('/:code/start', requireAuth, async (req, res) => {
  const { rows: challengeRows } = await pool.query('SELECT * FROM challenges WHERE code = $1', [req.params.code]);
  const challenge = challengeRows[0];
  if (!challenge) return res.status(404).json({ error: 'challenge_not_found' });

  const modeConfig = MODES.challenge;
  const questions = await getAllQuestions();
  const window = currentLeaderboardWindow();

  const { rows: sessionRows } = await pool.query(
    `INSERT INTO game_sessions
      (user_id, mode, category, canon_source, obscurity_filter, question_count, time_limit_ms, challenge_id, leaderboard_window)
     VALUES ($1, 'challenge', $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      req.userId,
      challenge.category,
      challenge.canon_source,
      challenge.obscurity_filter,
      modeConfig.questionCount,
      modeConfig.timeLimitMs,
      challenge.id,
      window,
    ],
  );
  const session = sessionRows[0];

  const firstQuestion = pickNextQuestion({ session, questions, position: 0, excludeIds: new Set() });
  if (!firstQuestion) return res.status(400).json({ error: 'no_eligible_questions' });

  const { question, token, issued_at } = await serveQuestion({ session, question: firstQuestion, position: 0 });
  return res.status(201).json({
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
    question,
    token,
    issued_at,
  });
});

export default router;
