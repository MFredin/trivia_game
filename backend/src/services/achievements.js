import { pool } from '../db/pool.js';
import { ACHIEVEMENTS } from '../lib/achievements.js';
import { getAllQuestions } from '../repo/questions.js';
import { sendToUser } from '../lib/wsServer.js';
import { computeStreaks } from '../lib/streaks.js';

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

  const { rows: duelRows } = await pool.query(
    `SELECT
       (SELECT total_score FROM game_sessions WHERE duel_id = d.id AND user_id = $1) AS mine,
       (SELECT total_score FROM game_sessions WHERE duel_id = d.id AND user_id != $1) AS theirs
     FROM duels d
     WHERE d.status = 'completed' AND (d.created_by = $1 OR d.opponent_id = $1)
     ORDER BY d.completed_at ASC`,
    [userId],
  );
  const duelsCompleted = duelRows.length;
  const duelsWon = duelRows.filter((r) => Number(r.mine) > Number(r.theirs)).length;
  // Longest historical run of consecutive wins, in play order — distinct from duelsWon
  // (total wins), which social_duel_wins_5 already covers.
  let duelWinStreak = 0;
  let currentRun = 0;
  for (const row of duelRows) {
    if (Number(row.mine) > Number(row.theirs)) {
      currentRun++;
      duelWinStreak = Math.max(duelWinStreak, currentRun);
    } else {
      currentRun = 0;
    }
  }

  const { rows: dateRows } = await pool.query(
    `SELECT DISTINCT DATE(completed_at)::text AS d FROM game_sessions
     WHERE user_id = $1 AND status = 'completed'
     ORDER BY d DESC`,
    [userId],
  );
  const { longest: longestDayStreak } = computeStreaks(dateRows.map((r) => r.d));

  const {
    rows: [challengeRow],
  } = await pool.query(
    `SELECT
       count(*) AS challenges_created,
       (SELECT max(player_count) FROM (
          SELECT c.id, count(DISTINCT gs.user_id) AS player_count
          FROM challenges c
          JOIN game_sessions gs ON gs.challenge_id = c.id AND gs.status = 'completed'
          WHERE c.created_by = $1
          GROUP BY c.id
        ) t) AS max_challenge_group_size
     FROM challenges WHERE created_by = $1`,
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
    duelsCompleted,
    duelsWon,
    duelWinStreak,
    longestDayStreak,
    challengesCreated: Number(challengeRow.challenges_created),
    maxChallengeGroupSize: Number(challengeRow.max_challenge_group_size ?? 0),
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
  social_friends_10: (s) => s.friendCount >= 10,
  duel_win_streak_3: (s) => s.duelWinStreak >= 3,
  duel_win_streak_5: (s) => s.duelWinStreak >= 5,
  consistency_streak_7: (s) => s.longestDayStreak >= 7,
  consistency_streak_30: (s) => s.longestDayStreak >= 30,
  social_challenge_creator: (s) => s.challengesCreated >= 1,
  social_challenge_group: (s) => s.maxChallengeGroupSize >= 3,
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
