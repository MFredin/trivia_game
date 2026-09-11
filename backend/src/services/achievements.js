import { pool } from '../db/pool.js';
import { ACHIEVEMENTS } from '../lib/achievements.js';
import { getAllQuestions } from '../repo/questions.js';
import { sendToUser } from '../lib/wsServer.js';

async function computeStats(userId) {
  const { rows: unlockedRows } = await pool.query(
    'SELECT achievement_id FROM user_achievements WHERE user_id = $1',
    [userId],
  );
  const unlocked = new Set(unlockedRows.map((r) => r.achievement_id));

  const {
    rows: [counts],
  } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE status = 'completed') AS total_completed,
       count(*) FILTER (
         WHERE status = 'completed' AND mode IN ('classic', 'daily')
         AND NOT EXISTS (SELECT 1 FROM session_questions sq WHERE sq.session_id = gs.id AND sq.correct = false)
       ) AS flawless_runs,
       count(*) FILTER (WHERE status = 'completed' AND obscurity_filter = 'N.E.W.T.') AS newt_runs,
       count(*) FILTER (WHERE status = 'completed' AND obscurity_filter = 'Order of the Phoenix') AS phoenix_runs,
       max(best_streak) AS max_streak,
       max(total_score) FILTER (WHERE mode = 'blitz' AND status = 'completed') AS blitz_high_score,
       count(DISTINCT category) FILTER (WHERE status = 'completed' AND category IS NOT NULL) AS categories_played,
       count(*) FILTER (WHERE status = 'completed' AND canon_source = 'books') AS books_only_runs,
       count(*) FILTER (WHERE status = 'completed' AND canon_source = 'movies') AS movies_only_runs,
       count(DISTINCT daily_key) FILTER (WHERE status = 'completed' AND daily_key IS NOT NULL) AS daily_days
     FROM game_sessions gs
     WHERE user_id = $1`,
    [userId],
  );

  const {
    rows: [enduranceRow],
  } = await pool.query(
    `SELECT max(answered_count) AS max_position FROM (
       SELECT gs.id, count(sq.id) AS answered_count
       FROM game_sessions gs
       JOIN session_questions sq ON sq.session_id = gs.id AND sq.answered_at IS NOT NULL
       WHERE gs.user_id = $1 AND gs.status = 'completed' AND gs.mode IN ('survival', 'gauntlet')
       GROUP BY gs.id
     ) t`,
    [userId],
  );

  const {
    rows: [friendRow],
  } = await pool.query(`SELECT count(*) AS friend_count FROM friendships WHERE user_id = $1 AND status = 'accepted'`, [
    userId,
  ]);

  const {
    rows: [duelRow],
  } = await pool.query(
    `SELECT
       count(*) AS duels_completed,
       count(*) FILTER (WHERE mine > theirs) AS duels_won
     FROM (
       SELECT d.id,
         (SELECT total_score FROM game_sessions WHERE duel_id = d.id AND user_id = $1) AS mine,
         (SELECT total_score FROM game_sessions WHERE duel_id = d.id AND user_id != $1) AS theirs
       FROM duels d
       WHERE d.status = 'completed' AND (d.created_by = $1 OR d.opponent_id = $1)
     ) t`,
    [userId],
  );

  const questions = await getAllQuestions();
  const totalCategories = new Set(questions.map((q) => q.category)).size;

  return {
    unlocked,
    totalCompleted: Number(counts.total_completed),
    flawlessRuns: Number(counts.flawless_runs),
    newtRuns: Number(counts.newt_runs),
    phoenixRuns: Number(counts.phoenix_runs),
    maxStreak: Number(counts.max_streak ?? 0),
    blitzHighScore: Number(counts.blitz_high_score ?? 0),
    categoriesPlayed: Number(counts.categories_played),
    totalCategories,
    booksOnlyRuns: Number(counts.books_only_runs),
    moviesOnlyRuns: Number(counts.movies_only_runs),
    dailyDays: Number(counts.daily_days),
    maxEndurancePosition: Number(enduranceRow.max_position ?? 0),
    friendCount: Number(friendRow.friend_count),
    duelsCompleted: Number(duelRow.duels_completed),
    duelsWon: Number(duelRow.duels_won),
  };
}

export const CONDITIONS = {
  milestone_1: (s) => s.totalCompleted >= 1,
  milestone_10: (s) => s.totalCompleted >= 10,
  milestone_50: (s) => s.totalCompleted >= 50,
  milestone_150: (s) => s.totalCompleted >= 150,
  mastery_flawless: (s) => s.flawlessRuns >= 1,
  mastery_newt: (s) => s.newtRuns >= 1,
  mastery_phoenix: (s) => s.phoenixRuns >= 1,
  streak_10: (s) => s.maxStreak >= 10,
  streak_20: (s) => s.maxStreak >= 20,
  streak_40: (s) => s.maxStreak >= 40,
  endurance_20: (s) => s.maxEndurancePosition >= 20,
  endurance_50: (s) => s.maxEndurancePosition >= 50,
  endurance_100: (s) => s.maxEndurancePosition >= 100,
  speed_1000: (s) => s.blitzHighScore >= 1000,
  speed_3000: (s) => s.blitzHighScore >= 3000,
  speed_6000: (s) => s.blitzHighScore >= 6000,
  explorer_all_categories: (s) => s.totalCategories > 0 && s.categoriesPlayed >= s.totalCategories,
  explorer_books: (s) => s.booksOnlyRuns >= 1,
  explorer_movies: (s) => s.moviesOnlyRuns >= 1,
  dedication_3: (s) => s.dailyDays >= 3,
  dedication_7: (s) => s.dailyDays >= 7,
  dedication_30: (s) => s.dailyDays >= 30,
  social_friend: (s) => s.friendCount >= 1,
  social_duel: (s) => s.duelsCompleted >= 1,
  social_duel_wins_5: (s) => s.duelsWon >= 5,
};

// Called after any event that could newly satisfy an achievement (a session completes, a
// friend request is accepted, a duel finishes). Cheap enough at hobby-project scale to just
// recompute the relevant aggregates from scratch rather than maintain incremental counters.
export async function evaluateAchievements(userId) {
  const stats = await computeStats(userId);
  const newlyUnlocked = ACHIEVEMENTS.filter((def) => !stats.unlocked.has(def.id) && CONDITIONS[def.id]?.(stats));

  for (const def of newlyUnlocked) {
    await pool.query(
      `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, def.id],
    );
    sendToUser(userId, { type: 'achievement:unlocked', achievement: def });
  }

  return newlyUnlocked;
}
