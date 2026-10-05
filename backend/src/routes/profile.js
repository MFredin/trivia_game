import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { ACHIEVEMENTS } from '../lib/achievements.js';
import { computeStreaks } from '../lib/streaks.js';
import { isOnline } from '../lib/presenceRegistry.js';
import { deriveStatus } from '../lib/friendStatus.js';
import { canSeeFriends } from '../lib/friendsVisibility.js';
import { isBlockedEitherWay, notBlockedSql } from '../services/blocks.js';
import { contactAllowed } from '../lib/contactModes.js';
import { titleView } from '../lib/titles.js';

const router = express.Router();

// Enough to show the profile owner has been at this, few enough that the plate stays a
// summary and the Achievements screen remains the place you go to see everything.
const ACHIEVEMENT_SHOWCASE_SIZE = 6;

const FRIENDS_PAGE_SIZE = 30;

// How the viewer stands towards the profile's owner, in the same words the member lists use,
// plus 'self'. One query for both directional rows; the profile and its friends list both need it.
async function relationshipOf(viewerId, user) {
  if (viewerId === user.id) return 'self';
  const { rows } = await pool.query(
    `SELECT f_out.status AS outgoing_status, f_in.status AS incoming_status
     FROM (SELECT 1) one
     LEFT JOIN friendships f_out ON f_out.user_id = $1 AND f_out.friend_user_id = $2
     LEFT JOIN friendships f_in ON f_in.user_id = $2 AND f_in.friend_user_id = $1`,
    [viewerId, user.id],
  );
  return deriveStatus(rows[0]);
}

async function findProfileUser(username) {
  const { rows } = await pool.query(
    `SELECT id, username, theme, avatar, avatar_style, created_at, friends_visibility, bio, favorite_book,
            favorite_subject, pinned_achievements, owl_post, challenges, title
     FROM users WHERE username = $1 AND deleted_at IS NULL`,
    [username],
  );
  return rows[0] ?? null;
}

const mayListFriends = (user, relationship) =>
  canSeeFriends({
    visibility: user.friends_visibility,
    isSelf: relationship === 'self',
    isFriend: relationship === 'friends',
  });

// Viewable by any logged-in player — the same openness the All Members directory already
// has. Everything here is read-only and derived from data the app already records; no new
// schema for this screen at all.
router.get('/:username', requireAuth, async (req, res) => {
  const user = await findProfileUser(req.params.username);
  if (!user || (await isBlockedEitherWay(req.userId, user.id))) return res.status(404).json({ error: 'user_not_found' });

  const relationship = await relationshipOf(req.userId, user);
  const friendsVisible = mayListFriends(user, relationship);

  const [friendCount, runStats, answerStats, favoriteCategory, duelStats, achievementStats, dateRows] = await Promise.all([
    // The count is only worked out for a viewer allowed to see the list: a number is a leak too.
    friendsVisible
      ? pool.query(`SELECT count(*) AS n FROM friendships WHERE user_id = $1 AND status = 'accepted'`, [user.id])
      : null,
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
  const unlocked = achievementStats.rows
    .map((row) => {
      const def = ACHIEVEMENTS.find((a) => a.id === row.achievement_id);
      return def ? { ...def, unlocked_at: row.unlocked_at } : null;
    })
    .filter(Boolean);

  // What the player chose to show, in the order they chose it — if they chose anything that is
  // still unlocked and still in the catalog. Otherwise the most recent, as before.
  const pinned = (user.pinned_achievements ?? []).map((id) => unlocked.find((a) => a.id === id)).filter(Boolean);
  const showcase = pinned.length > 0 ? pinned : unlocked.slice(0, ACHIEVEMENT_SHOWCASE_SIZE);

  return res.json({
    username: user.username,
    theme: user.theme,
    avatar: user.avatar ?? null,
    avatar_style: user.avatar_style ?? {},
    title: titleView(user.title),
    bio: user.bio ?? null,
    favorite_book: user.favorite_book ?? null,
    favorite_subject: user.favorite_subject ?? null,
    achievements_pinned: pinned.length > 0,
    member_since: user.created_at,
    online: isOnline(user.id),
    relationship,
    // What the viewer may start with them — their settings are public, and the page offers only what would be accepted.
    can_owl: contactAllowed(user.owl_post, relationship === 'friends'),
    can_challenge: contactAllowed(user.challenges, relationship === 'friends'),
    friends: { visible: friendsVisible, count: friendsVisible ? Number(friendCount.rows[0].n) : null },
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

// Everyone this player is friends with, for the Friends plate on their profile. A viewer who
// may not see the list gets a 200 saying so — not a 404 — because the profile itself is open and
// the page needs to know to render "private", not "missing".
router.get('/:username/friends', requireAuth, async (req, res) => {
  const user = await findProfileUser(req.params.username);
  if (!user || (await isBlockedEitherWay(req.userId, user.id))) return res.status(404).json({ error: 'user_not_found' });

  const relationship = await relationshipOf(req.userId, user);
  if (!mayListFriends(user, relationship)) {
    return res.json({ visible: false, friends: [], total: null, has_more: false });
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || FRIENDS_PAGE_SIZE, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(
      `SELECT u.id, u.username, u.avatar, u.avatar_style, u.theme
       FROM friendships f
       JOIN users u ON u.id = f.friend_user_id
       WHERE f.user_id = $1 AND f.status = 'accepted' AND ${notBlockedSql('$4', 'u.id')}
       ORDER BY u.username
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset, req.userId],
    ),
    pool.query(
      `SELECT count(*) AS n FROM friendships f
       WHERE f.user_id = $1 AND f.status = 'accepted' AND ${notBlockedSql('$2', 'f.friend_user_id')}`,
      [user.id, req.userId],
    ),
  ]);
  const total = Number(countRows[0].n);

  return res.json({
    visible: true,
    friends: rows.map((r) => ({
      username: r.username,
      avatar: r.avatar ?? null,
      avatar_style: r.avatar_style ?? {},
      theme: r.theme,
      online: isOnline(r.id),
    })),
    total,
    has_more: offset + rows.length < total,
  });
});

export default router;
