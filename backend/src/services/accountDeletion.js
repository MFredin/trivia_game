import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { getSockets } from '../lib/presenceRegistry.js';
import { DELETED_PLAYER_NAME } from '../lib/displayName.js';

/**
 * Delete a player's account by anonymising it.
 *
 * The row is not removed: duels, challenge leaderboards and the other player's history all point
 * at it, and deleting it would either fail on those references or erase things that belong to
 * other people. Instead everything that identifies the player is removed or overwritten — name,
 * email, password, avatar, bio and profile choices, invite code, friendships, blocks, achievements,
 * Owl Post messages, activity — and what is
 * left is a numbered husk that other players see as "Deleted player" (lib/displayName.js).
 *
 * Their runs and scores stay, un-attributed. A name is also written INTO other players' rows (the
 * "won a duel against ___" activity line), so that is rewritten too.
 *
 * All in one transaction: a half-deleted account — email gone but the name still showing, say —
 * is worse than either state.
 */
export async function deleteAccount(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT username FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [
      userId,
    ]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    const oldUsername = rows[0].username;

    await client.query(
      `UPDATE users
       SET username = $2, email = NULL, password_hash = NULL, invite_code = NULL, avatar = NULL, avatar_style = '{}', bio = NULL,
           favorite_book = NULL, favorite_subject = NULL, pinned_achievements = '{}', title = NULL,
           theme = 'monochrome', is_admin = false, is_moderator = false, age_confirmed_at = NULL, friends_visibility = 'only_me', deleted_at = now()
       WHERE id = $1`,
      [userId, `deleted-${userId}-${crypto.randomBytes(4).toString('hex')}`],
    );

    await client.query('DELETE FROM friendships WHERE user_id = $1 OR friend_user_id = $1', [userId]);
    await client.query('DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1', [userId]);
    await client.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_titles WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM email_tokens WHERE user_id = $1', [userId]);
    // Owl Post, both ways: what they sent is theirs to take back, and what they received from a
    // player who is now "Deleted player" has nowhere left to be read.
    await client.query('DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1', [userId]);
    await client.query('DELETE FROM activity_events WHERE user_id = $1', [userId]);
    await client.query(
      `UPDATE activity_events
       SET payload = jsonb_set(payload, '{opponent_username}', to_jsonb($2::text))
       WHERE type = 'duel_win' AND payload->>'opponent_username' = $1`,
      [oldUsername, DELETED_PLAYER_NAME],
    );
    await client.query(
      `UPDATE duels SET status = 'declined'
       WHERE status = 'pending' AND (created_by = $1 OR opponent_id = $1)`,
      [userId],
    );

    // A tournament still open loses them; one they were hosting is cancelled. One already running keeps its shape (their
    // matches forfeit at the next sweep, since the account can no longer play) and shows them as "Deleted player".
    await client.query(
      `DELETE FROM tournament_players WHERE user_id = $1 AND tournament_id IN (SELECT id FROM tournaments WHERE status = 'open')`,
      [userId],
    );
    await client.query(`UPDATE tournaments SET status = 'cancelled' WHERE created_by = $1 AND status = 'open'`, [userId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // After the commit, so a socket is never closed on an account that then fails to delete. Reaching here means
  // it was deleted: an account that was already gone returned false above.
  for (const ws of getSockets(userId)) ws.close();
  return true;
}
