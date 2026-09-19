import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { ACHIEVEMENTS } from '../lib/achievements.js';
import { computeStreaks } from '../lib/streaks.js';

const router = express.Router();

// Enough to show the profile owner has been at this, few enough that the plate stays a
// summary and the Achievements screen remains the place you go to see everything.
const ACHIEVEMENT_SHOWCASE_SIZE = 6;

// Viewable by any logged-in player — the same openness the All Members directory already
// has. Everything here is read-only and derived from data the app already records; no new
// schema for this screen at all.
router.get('/:username', requireAuth, async (req, res) => {
  const { rows: userRows } = await pool.query('SELECT id, username, theme FROM users WHERE username = $1', [
    req.params.username,
  ]);
  const user = userRows[0];
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const [runStats, answerStats, favoriteCategory, duelStats, achievementStats, dateRows] = await Promise.all([
    pool.query(
      `SELECT count(*) FILTER (WHERE status = 'completed') AS total_completed,
              max(best_streak) AS max_best_streak,
              max(total_score) FILTER (WHERE status = 'completed') AS best_score
       FROM game_sessions WHERE user_id = $1`,
      [user.id],
    ),
    pool.query(
      `SELECT count(*) AS total_answered, count(*) FILTER (WHERE correct = true) AS correct_answered
       FROM session_questions sq
       JOIN game_sessions gs ON gs.id = sq.session_id
       WHERE gs.user_id = $1 AND sq.answered_at IS NOT NULL`,
      [user.id],
    ),
    pool.query(
      `SELECT category FROM game_sessions
       WHERE user_id = $1 AND status = 'completed' AND category IS NOT NULL
       GROUP BY category
       ORDER BY count(*) DESC, sum(total_score) DESC
       LIMIT 1`,
      [user.id],
    ),
    pool.query(
      `SELECT count(*) AS duels_completed, count(*) FILTER (WHERE mine > theirs) AS duels_won
       FROM (
         SELECT d.id,
           (SELECT total_score FROM game_sessions WHERE duel_id = d.id AND user_id = $1) AS mine,
           (SELECT total_score FROM game_sessions WHERE duel_id = d.id AND user_id != $1) AS theirs
         FROM duels d
         WHERE d.status = 'completed' AND (d.created_by = $1 OR d.opponent_id = $1)
       ) t`,
      [user.id],
    ),
    // Rows rather than a bare count: the same query now feeds both the "X / 32" figure and
    // the showcase below it, so surfacing actual badges costs no extra round trip.
    pool.query(
      'SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1 ORDER BY unlocked_at DESC',
      [user.id],
    ),
    pool.query(
      `SELECT DISTINCT DATE(completed_at)::text AS d FROM game_sessions
       WHERE user_id = $1 AND status = 'completed'
       ORDER BY d DESC`,
      [user.id],
    ),
  ]);

  const totalAnswered = Number(answerStats.rows[0].total_answered);
  const correctAnswered = Number(answerStats.rows[0].correct_answered);
  const streaks = computeStreaks(dateRows.rows.map((r) => r.d));

  // The most recent unlocks, resolved against the catalog. Joined here rather than in SQL
  // because ACHIEVEMENTS is deploy-time content, not a table. A row whose id is no longer in
  // the catalog (an achievement retired in a later release) is dropped rather than rendered
  // as a blank card.
  const showcase = achievementStats.rows
    .map((row) => {
      const def = ACHIEVEMENTS.find((a) => a.id === row.achievement_id);
      return def ? { ...def, unlocked_at: row.unlocked_at } : null;
    })
    .filter(Boolean)
    .slice(0, ACHIEVEMENT_SHOWCASE_SIZE);

  return res.json({
    username: user.username,
    theme: user.theme,
    total_completed: Number(runStats.rows[0].total_completed),
    total_questions_answered: totalAnswered,
    accuracy_pct: totalAnswered > 0 ? Math.round((correctAnswered / totalAnswered) * 1000) / 10 : null,
    favorite_category: favoriteCategory.rows[0]?.category ?? null,
    best_score: Number(runStats.rows[0].best_score ?? 0),
    max_best_streak: Number(runStats.rows[0].max_best_streak ?? 0),
    duels_completed: Number(duelStats.rows[0].duels_completed),
    duels_won: Number(duelStats.rows[0].duels_won),
    achievements_unlocked: achievementStats.rows.length,
    achievements_showcase: showcase,
    achievements_total: ACHIEVEMENTS.length,
    current_day_streak: streaks.current,
    longest_day_streak: streaks.longest,
  });
});

export default router;
