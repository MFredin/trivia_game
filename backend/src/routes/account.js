import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { isValidAvatar } from '../lib/avatars.js';
import { isValidFriendsVisibility } from '../lib/friendsVisibility.js';
import { USER_COLUMNS, userView } from '../lib/userView.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { rateLimit } from '../lib/rateLimiter.js';
import { deleteAccount } from '../services/accountDeletion.js';

const router = express.Router();

router.use(requireAuth);

// Both routes below check a password, so both are somewhere a stolen token could be turned into
// a password guess or a deletion. Keyed by the player rather than the IP — the limiter's buckets
// are one shared map and the login limiter already uses the IP.
const credentialRateLimit = rateLimit({ max: 10, windowMs: 15 * 60 * 1000, keyFn: (req) => `account:${req.userId}` });

async function passwordMatches(userId, password) {
  if (typeof password !== 'string') return false;
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  return Boolean(rows[0]?.password_hash) && verifyPassword(password, rows[0].password_hash);
}

// `null` clears the sigil and goes back to the initial; anything that is not null or a known
// sigil id is refused rather than stored, so the column can only ever hold something the
// frontend knows how to draw.
router.patch('/avatar', async (req, res) => {
  const { avatar } = req.body ?? {};
  if (avatar !== null && typeof avatar !== 'string') return res.status(400).json({ error: 'invalid_avatar' });
  if (!isValidAvatar(avatar)) return res.status(400).json({ error: 'invalid_avatar' });

  const { rows } = await pool.query(`UPDATE users SET avatar = $1 WHERE id = $2 RETURNING ${USER_COLUMNS}`, [
    avatar,
    req.userId,
  ]);
  return res.json({ user: userView(rows[0]) });
});

router.patch('/privacy', async (req, res) => {
  const { friends_visibility: visibility } = req.body ?? {};
  if (!isValidFriendsVisibility(visibility)) return res.status(400).json({ error: 'invalid_friends_visibility' });

  const { rows } = await pool.query(
    `UPDATE users SET friends_visibility = $1 WHERE id = $2 RETURNING ${USER_COLUMNS}`,
    [visibility, req.userId],
  );
  return res.json({ user: userView(rows[0]) });
});

router.patch('/password', credentialRateLimit, async (req, res) => {
  const { current_password: current, new_password: next } = req.body ?? {};
  if (typeof next !== 'string' || next.length < 8) return res.status(400).json({ error: 'password_too_short' });
  if (!(await passwordMatches(req.userId, current))) return res.status(400).json({ error: 'incorrect_password' });

  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(next), req.userId]);
  return res.status(204).end();
});

// Deletes the signed-in player's own account — there is no id in the path to prove ownership of.
// The password is required even with a valid token: this cannot be undone, and a token left on a
// shared device is exactly the situation it must not be enough for.
router.delete('/', credentialRateLimit, async (req, res) => {
  if (!(await passwordMatches(req.userId, req.body?.password))) {
    return res.status(400).json({ error: 'incorrect_password' });
  }
  await deleteAccount(req.userId);
  return res.status(204).end();
});

export default router;
