import { pool } from '../db/pool.js';

// SQL for "these two players have no block between them, in either direction". `viewer` and
// `other` are SQL expressions (a $n placeholder, or a column), written in rather than bound
// here so the same condition drops into a search, a directory, a friends list.
export function notBlockedSql(viewer, other) {
  return `NOT EXISTS (
    SELECT 1 FROM blocks bl
    WHERE (bl.blocker_id = ${viewer} AND bl.blocked_id = ${other})
       OR (bl.blocker_id = ${other} AND bl.blocked_id = ${viewer})
  )`;
}

export async function isBlockedEitherWay(a, b) {
  const { rows } = await pool.query(
    `SELECT 1 FROM blocks
     WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
    [a, b],
  );
  return rows.length > 0;
}

// Blocking does three things at once, in one transaction so a half-applied block is impossible:
// records the block, ends any friendship or pending request between the two, and withdraws any
// duel invite still waiting between them. A duel already under way is left to finish — the
// reaction relay refuses to carry anything between them from here on, which is the only way
// they could reach each other in it.
export async function blockUser(blockerId, blockedId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [blockerId, blockedId],
    );
    await client.query(
      `DELETE FROM friendships
       WHERE (user_id = $1 AND friend_user_id = $2) OR (user_id = $2 AND friend_user_id = $1)`,
      [blockerId, blockedId],
    );
    await client.query(
      `UPDATE duels SET status = 'declined'
       WHERE status = 'pending'
         AND ((created_by = $1 AND opponent_id = $2) OR (created_by = $2 AND opponent_id = $1))`,
      [blockerId, blockedId],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
