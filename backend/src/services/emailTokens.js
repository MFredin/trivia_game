import crypto from 'node:crypto';
import { pool } from '../db/pool.js';

// One-time links sent by email. What is sent is a random token; what is stored is only its hash, so
// reading the table (a backup, a leak) gives no one a working link. A token is for one purpose, lives
// for a short time, works once, and a newer one for the same account and purpose replaces it.
export const PURPOSES = { reset: 'password_reset', deletion: 'account_deletion' };
const TTL_MINUTES = 60;

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function createToken(userId, purpose) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query('DELETE FROM email_tokens WHERE user_id = $1 AND purpose = $2', [userId, purpose]);
  await pool.query(
    `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [userId, purpose, hash(token), TTL_MINUTES],
  );
  return token;
}

/** Whose token this is, if it is valid now; null if not. Does not use it up. */
export async function peekToken(token, purpose) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const { rows } = await pool.query(
    `SELECT user_id FROM email_tokens WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()`,
    [hash(token), purpose],
  );
  return rows[0]?.user_id ?? null;
}

/** Uses the token up and returns whose it was, or null. Two requests with one token cannot both succeed. */
export async function consumeToken(token, purpose) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const { rows } = await pool.query(
    `UPDATE email_tokens SET used_at = now()
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
    [hash(token), purpose],
  );
  return rows[0]?.user_id ?? null;
}

// How many links one address may be sent in a day, whatever it asks for: counted from the tokens made.
// (A new token replaces the old, so this counts rows by creation, kept for a day.)
export async function recentlySentCount(userId) {
  const { rows } = await pool.query(
    `SELECT count(*) AS n FROM email_token_log WHERE user_id = $1 AND created_at > now() - interval '24 hours'`,
    [userId],
  );
  return Number(rows[0].n);
}

export async function logSend(userId) {
  await pool.query('INSERT INTO email_token_log (user_id) VALUES ($1)', [userId]);
}

export async function sweepExpiredTokens() {
  await pool.query(`DELETE FROM email_tokens WHERE expires_at < now() - interval '1 day' OR used_at < now() - interval '1 day'`);
  await pool.query(`DELETE FROM email_token_log WHERE created_at < now() - interval '2 days'`);
}

setInterval(() => sweepExpiredTokens().catch(() => {}), 60 * 60 * 1000).unref();
