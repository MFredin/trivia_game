import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { MODES } from '../lib/modes.js';
import { OBSCURITY_TIERS } from '../lib/difficultyTiers.js';
import { currentLeaderboardWindow } from '../lib/leaderboardWindow.js';
import { sendToUser } from '../lib/wsServer.js';
import { getAllQuestions } from '../repo/questions.js';
import { pickNextQuestion, serveQuestion } from '../services/sessionQuestions.js';
import { getCached, setCached } from '../lib/leaderboardCache.js';

const router = express.Router();

router.use(requireAuth);

function duelSummary(duel) {
  return {
    duel_id: duel.id,
    created_by: duel.created_by,
    opponent_id: duel.opponent_id,
    category: duel.category,
    canon_source: duel.canon_source,
    difficulty: duel.obscurity_filter,
    question_count: duel.question_count,
    time_limit_ms: duel.time_limit_ms,
    status: duel.status,
    created_at: duel.created_at,
    started_at: duel.started_at,
    completed_at: duel.completed_at,
  };
}

async function findUserByUsername(username) {
  const { rows } = await pool.query('SELECT id, username FROM users WHERE username = $1', [username]);
  return rows[0] ?? null;
}

router.post('/', async (req, res) => {
  const { opponent_username, category, canon_source, difficulty } = req.body ?? {};
  if (typeof opponent_username !== 'string' || opponent_username.trim().length === 0) {
    return res.status(400).json({ error: 'invalid_opponent' });
  }
  const canonSource = canon_source ?? 'combined';
  if (!['books', 'movies', 'combined'].includes(canonSource)) {
    return res.status(400).json({ error: 'invalid_canon_source' });
  }
  if (difficulty && !OBSCURITY_TIERS.includes(difficulty)) {
    return res.status(400).json({ error: 'invalid_difficulty' });
  }

  const opponent = await findUserByUsername(opponent_username.trim());
  if (!opponent) return res.status(404).json({ error: 'user_not_found' });
  if (opponent.id === req.userId) return res.status(400).json({ error: 'cannot_duel_yourself' });

  // A double-click (or re-visiting the Challenge flow before the invite's been answered)
  // shouldn't stack up repeat pending invites cluttering the recipient's screen — return the
  // existing one instead of creating a duplicate.
  const { rows: existingRows } = await pool.query(
    `SELECT * FROM duels WHERE created_by = $1 AND opponent_id = $2 AND status = 'pending'`,
    [req.userId, opponent.id],
  );
  if (existingRows.length > 0) {
    return res.status(200).json({ ...duelSummary(existingRows[0]), opponent_username: opponent.username });
  }

  const modeConfig = MODES.duel;
  const { rows } = await pool.query(
    `INSERT INTO duels (created_by, opponent_id, category, canon_source, obscurity_filter, question_count, time_limit_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [req.userId, opponent.id, category ?? null, canonSource, difficulty ?? null, modeConfig.questionCount, modeConfig.timeLimitMs],
  );
  const duel = rows[0];
  const { rows: meRows } = await pool.query('SELECT username FROM users WHERE id = $1', [req.userId]);

  sendToUser(opponent.id, {
    type: 'duel:invited',
    duel: { ...duelSummary(duel), created_by_username: meRows[0].username },
  });
  return res.status(201).json({ ...duelSummary(duel), opponent_username: opponent.username });
});

router.get('/pending', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT d.*, u_creator.username AS created_by_username, u_opponent.username AS opponent_username
     FROM duels d
     JOIN users u_creator ON u_creator.id = d.created_by
     JOIN users u_opponent ON u_opponent.id = d.opponent_id
     WHERE d.status = 'pending' AND (d.created_by = $1 OR d.opponent_id = $1)
     ORDER BY d.created_at DESC`,
    [req.userId],
  );
  const pending = rows.map((d) => ({
    ...duelSummary(d),
    created_by_username: d.created_by_username,
    opponent_username: d.opponent_username,
    direction: d.created_by === req.userId ? 'outgoing' : 'incoming',
  }));
  return res.json({ pending });
});

router.get('/leaderboard', async (req, res) => {
  const scope = req.query.scope === 'friends' ? 'friends' : 'global';
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const cacheKey = JSON.stringify({ kind: 'duel-leaderboard', scope, limit, userId: req.userId });
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const conditions = [];
  const params = [];
  if (scope === 'friends') {
    params.push(req.userId);
    conditions.push(
      `p.user_id = $${params.length} OR p.user_id IN (SELECT friend_user_id FROM friendships WHERE user_id = $${params.length} AND status = 'accepted')`,
    );
  }
  params.push(limit);

  const { rows } = await pool.query(
    `WITH duel_results AS (
       SELECT gs.user_id, gs.total_score,
         (SELECT total_score FROM game_sessions WHERE duel_id = d.id AND user_id != gs.user_id) AS opponent_score
       FROM duels d
       JOIN game_sessions gs ON gs.duel_id = d.id
       WHERE d.status = 'completed'
     ),
     per_user AS (
       SELECT user_id,
         count(*) FILTER (WHERE total_score > opponent_score) AS wins,
         count(*) FILTER (WHERE total_score < opponent_score) AS losses,
         count(*) FILTER (WHERE total_score = opponent_score) AS ties,
         count(*) AS total
       FROM duel_results
       GROUP BY user_id
     )
     SELECT u.username, p.wins, p.losses, p.ties, p.total,
       CASE WHEN p.total > 0 THEN round((p.wins::numeric / p.total) * 100, 1) ELSE 0 END AS win_pct
     FROM per_user p
     JOIN users u ON u.id = p.user_id
     ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY win_pct DESC, p.wins DESC, p.total DESC
     LIMIT $${params.length}`,
    params,
  );

  const entries = rows.map((r) => ({
    username: r.username,
    wins: Number(r.wins),
    losses: Number(r.losses),
    ties: Number(r.ties),
    total: Number(r.total),
    win_pct: Number(r.win_pct),
  }));
  const result = { scope, entries };
  setCached(cacheKey, result);
  return res.json(result);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM duels WHERE id = $1', [req.params.id]);
  const duel = rows[0];
  if (!duel) return res.status(404).json({ error: 'duel_not_found' });
  if (duel.created_by !== req.userId && duel.opponent_id !== req.userId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { rows: sessionRows } = await pool.query('SELECT user_id, total_score, status FROM game_sessions WHERE duel_id = $1', [
    duel.id,
  ]);
  return res.json({ ...duelSummary(duel), sessions: sessionRows });
});

router.post('/:id/decline', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM duels WHERE id = $1', [req.params.id]);
  const duel = rows[0];
  if (!duel) return res.status(404).json({ error: 'duel_not_found' });
  if (duel.opponent_id !== req.userId) return res.status(403).json({ error: 'forbidden' });
  if (duel.status !== 'pending') return res.status(409).json({ error: 'duel_not_pending' });

  await pool.query(`UPDATE duels SET status = 'declined' WHERE id = $1`, [duel.id]);
  sendToUser(duel.created_by, { type: 'duel:declined', duel_id: duel.id });
  return res.status(204).end();
});

router.post('/:id/accept', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM duels WHERE id = $1', [req.params.id]);
    const duel = rows[0];
    if (!duel) return res.status(404).json({ error: 'duel_not_found' });
    if (duel.opponent_id !== req.userId) return res.status(403).json({ error: 'forbidden' });
    if (duel.status !== 'pending') return res.status(409).json({ error: 'duel_not_pending' });

    await pool.query(`UPDATE duels SET status = 'active', started_at = now() WHERE id = $1`, [duel.id]);

    const questions = await getAllQuestions();
    const window = currentLeaderboardWindow();
    const participants = [duel.created_by, duel.opponent_id];
    const served = {};

    for (const participantId of participants) {
      const { rows: sessionRows } = await pool.query(
        `INSERT INTO game_sessions
          (user_id, mode, category, canon_source, obscurity_filter, question_count, time_limit_ms, duel_id, leaderboard_window)
         VALUES ($1, 'duel', $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          participantId,
          duel.category,
          duel.canon_source,
          duel.obscurity_filter,
          duel.question_count,
          duel.time_limit_ms,
          duel.id,
          window,
        ],
      );
      const session = sessionRows[0];
      const firstQuestion = pickNextQuestion({ session, questions, position: 0, excludeIds: new Set() });
      if (!firstQuestion) {
        return res.status(400).json({ error: 'no_eligible_questions' });
      }
      const { question, token, issued_at } = await serveQuestion({ session, question: firstQuestion, position: 0 });
      served[participantId] = { session, question, token, issued_at };
    }

    // The initiator isn't making this HTTP request, so they only learn the duel started via WS.
    sendToUser(duel.created_by, {
      type: 'duel:started',
      duel_id: duel.id,
      session_id: served[duel.created_by].session.id,
      question: served[duel.created_by].question,
      token: served[duel.created_by].token,
      issued_at: served[duel.created_by].issued_at,
      time_limit_ms: duel.time_limit_ms,
    });

    // The acceptor IS making this request, so they get their own start payload directly.
    const mine = served[req.userId];
    return res.status(200).json({
      duel_id: duel.id,
      session_id: mine.session.id,
      question: mine.question,
      token: mine.token,
      issued_at: mine.issued_at,
      time_limit_ms: duel.time_limit_ms,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
