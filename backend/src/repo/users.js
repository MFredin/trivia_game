import { pool } from '../db/pool.js';

// Whether a signed token still belongs to a live account. Tokens are stateless and last thirty
// days, so a deleted account's token is still cryptographically valid; this is what stops it
// working. One primary-key lookup — cheap enough to run on every authenticated request.
export async function isActiveUser(userId) {
  const { rows } = await pool.query('SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
  return rows.length > 0;
}
