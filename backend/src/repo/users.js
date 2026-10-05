import { pool } from '../db/pool.js';

/**
 * Whether a signed token still belongs to an account that may use the app, and if not, why.
 * Tokens are stateless and last thirty days, so a deleted, suspended or banned account's token
 * still verifies; this is what stops it working, on the very next request. One primary-key lookup
 * — cheap enough to run on every authenticated request.
 *
 * `state` is 'active', 'suspended' (with `until`), 'banned', or 'gone' (deleted or never existed).
 */
export async function getAccountAccess(userId, tokenVersion) {
  const { rows } = await pool.query(
    'SELECT deleted_at, banned_at, suspended_until, token_version FROM users WHERE id = $1',
    [userId],
  );
  const row = rows[0];
  if (!row || row.deleted_at) return { state: 'gone' };
  // A token from before the password was last changed or reset: the person is known, the credential is not.
  // Left undefined by callers that have no token (login, which has just checked the password).
  if (tokenVersion !== undefined && tokenVersion !== row.token_version) return { state: 'gone' };
  if (row.banned_at) return { state: 'banned' };
  if (row.suspended_until && row.suspended_until > new Date()) return { state: 'suspended', until: row.suspended_until };
  return { state: 'active' };
}

export async function isActiveUser(userId, tokenVersion) {
  return (await getAccountAccess(userId, tokenVersion)).state === 'active';
}

// What the moderator wrote for a player who is currently locked out, so the screen that turns them
// away can say why. The most recent suspension or ban that has not been lifted.
export async function restrictionNote(userId) {
  const { rows } = await pool.query(
    `SELECT note FROM moderation_actions
     WHERE user_id = $1 AND action IN ('suspend', 'ban') AND lifted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0]?.note ?? null;
}
