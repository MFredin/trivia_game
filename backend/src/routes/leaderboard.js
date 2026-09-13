import express from 'express';
import { pool } from '../db/pool.js';
import { MODES } from '../lib/modes.js';
import { OBSCURITY_TIERS } from '../lib/difficultyTiers.js';
import { getCached, setCached } from '../lib/leaderboardCache.js';
import { currentLeaderboardWindow } from '../lib/leaderboardWindow.js';
import { dailyKeyFor } from '../lib/questionSelection.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  const mode = MODES[req.query.mode] ? req.query.mode : 'classic';
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const category = typeof req.query.category === 'string' ? req.query.category : null;
  const canonSource = ['books', 'movies', 'combined'].includes(req.query.canon_source)
    ? req.query.canon_source
    : null;
  const difficulty = OBSCURITY_TIERS.includes(req.query.difficulty) ? req.query.difficulty : null;
  const scope = req.query.scope === 'friends' ? 'friends' : 'global';
  // "current" = This Week (or, for Daily Challenge, today) — the default, rotating view so a
  // great run doesn't sit unbeatable forever. "all" = the all-time Hall of Fame board.
  const window = req.query.window === 'all' ? 'all' : 'current';

  if (scope === 'friends' && !req.userId) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const cacheKey = JSON.stringify({ mode, limit, category, canonSource, difficulty, scope, window, userId: req.userId });
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const conditions = [`gs.mode = $1`, `gs.status = 'completed'`];
  const params = [mode];

  if (category) {
    params.push(category);
    conditions.push(`gs.category = $${params.length}`);
  }
  if (canonSource) {
    params.push(canonSource);
    conditions.push(`gs.canon_source = $${params.length}`);
  }
  if (difficulty) {
    params.push(difficulty);
    conditions.push(`gs.obscurity_filter = $${params.length}`);
  }
  if (scope === 'friends') {
    params.push(req.userId);
    conditions.push(
      `(gs.user_id = $${params.length} OR gs.user_id IN (SELECT friend_user_id FROM friendships WHERE user_id = $${params.length}))`,
    );
  }
  if (window === 'current') {
    if (mode === 'daily') {
      params.push(dailyKeyFor());
      conditions.push(`gs.daily_key = $${params.length}`);
    } else {
      params.push(currentLeaderboardWindow());
      conditions.push(`gs.leaderboard_window = $${params.length}`);
    }
  }
  params.push(limit);

  // A user can rack up many completed runs matching the same filters — rank them by their own
  // best run first (score, then speed), and keep only that top row so the board shows each
  // player once instead of letting one prolific player fill it with their own past attempts.
  const { rows } = await pool.query(
    `WITH ranked AS (
       SELECT u.username, gs.total_score, gs.category, gs.canon_source, gs.obscurity_filter AS difficulty,
              gs.completed_at, (gs.completed_at - gs.created_at) AS duration,
              ROW_NUMBER() OVER (
                PARTITION BY gs.user_id
                ORDER BY gs.total_score DESC, (gs.completed_at - gs.created_at) ASC
              ) AS rn
       FROM game_sessions gs
       JOIN users u ON u.id = gs.user_id
       WHERE ${conditions.join(' AND ')}
     )
     SELECT username, total_score, category, canon_source, difficulty, completed_at
     FROM ranked
     WHERE rn = 1
     ORDER BY total_score DESC, duration ASC
     LIMIT $${params.length}`,
    params,
  );

  const result = { mode, category, canon_source: canonSource, difficulty, scope, window, entries: rows };
  setCached(cacheKey, result);
  return res.json(result);
});

export default router;
