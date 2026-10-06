import { MINIMUM_AGE, checkBirthDate, isOldEnough } from '../lib/ageGate.js';
import crypto from 'node:crypto';
import express from 'express';
import { pool } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { signAuthToken } from '../lib/authTokens.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimiter.js';
import { USER_COLUMNS, userView } from '../lib/userView.js';
import { isReservedUsername } from '../lib/usernames.js';
import { hashEmail } from '../lib/emailHash.js';
import { getAccountAccess, restrictionNote } from '../repo/users.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_THEMES = ['gryffindor', 'hufflepuff', 'slytherin', 'ravenclaw', 'monochrome'];

// Credential-stuffing/brute-force throttle — narrowly scoped to these two routes so normal
// gameplay traffic is never affected. Keyed by IP; see lib/rateLimiter.js for the tradeoffs.
// AUTH_RATE_LIMIT_MAX exists for the browser tests, which sign a dozen players up and in from one
// address inside one window; production leaves it unset and gets ten.
const authRateLimit = rateLimit({ max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10, windowMs: 15 * 60 * 1000 });

router.post('/register', authRateLimit, async (req, res) => {
  const { email, username, password, invite_code, birth_month, birth_year } = req.body ?? {};

  // Age first, before anything else is read or kept. Under the minimum there is no account, no email
  // and no name stored, and the date itself is never stored for anyone.
  const born = checkBirthDate({ month: birth_month, year: birth_year });
  if (!born.ok) return res.status(400).json({ error: 'invalid_birth_date' });
  if (!isOldEnough(born)) return res.status(403).json({ error: 'underage', minimum_age: MINIMUM_AGE });

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (typeof username !== 'string' || username.trim().length === 0 || username.length > 40 || isReservedUsername(username)) {
    return res.status(400).json({ error: 'invalid_username' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password_too_short' });
  }

  // A banned player's email stays unusable after they delete the account. Answered as an ordinary
  // collision, so the response does not say that this address is one that was banned.
  const { rows: bannedRows } = await pool.query('SELECT 1 FROM banned_emails WHERE email_hash = $1', [
    hashEmail(email),
  ]);
  if (bannedRows.length > 0) return res.status(409).json({ error: 'email_or_username_taken' });

  const passwordHash = hashPassword(password);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, age_confirmed_at) VALUES ($1, $2, $3, now())
       RETURNING ${USER_COLUMNS}, token_version`,
      [username.trim(), email.toLowerCase().trim(), passwordHash],
    );
    const user = rows[0];

    // An invite link only ever helps registration along — an unknown, missing, or malformed
    // code is silently ignored rather than blocking signup over a stale or mistyped link.
    if (typeof invite_code === 'string' && invite_code.trim()) {
      const { rows: inviterRows } = await pool.query('SELECT id FROM users WHERE invite_code = $1', [
        invite_code.trim(),
      ]);
      const inviter = inviterRows[0];
      if (inviter && inviter.id !== user.id) {
        await pool.query(
          `INSERT INTO friendships (user_id, friend_user_id, status, requested_by)
           VALUES ($1, $2, 'accepted', $1), ($2, $1, 'accepted', $1)
           ON CONFLICT (user_id, friend_user_id) DO UPDATE SET status = 'accepted'`,
          [inviter.id, user.id],
        );
      }
    }

    return res.status(201).json({ token: signAuthToken(user.id, user.token_version), user: userView(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'email_or_username_taken' });
    }
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/login', authRateLimit, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'invalid_request' });
  }

  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS}, password_hash, token_version FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  const user = rows[0];
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  // After the password, not before: telling someone they are suspended is telling them the account
  // exists, which should take its password.
  const access = await getAccountAccess(user.id);
  if (access.state === 'suspended' || access.state === 'banned') {
    return res.status(403).json({
      error: access.state === 'banned' ? 'account_banned' : 'account_suspended',
      until: access.until,
      note: await restrictionNote(user.id),
    });
  }

  return res.json({ token: signAuthToken(user.id, user.token_version), user: userView(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [
    req.userId,
  ]);
  if (rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
  return res.json({ user: userView(rows[0]) });
});

router.get('/invite-code', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT invite_code FROM users WHERE id = $1', [req.userId]);
  const existing = rows[0]?.invite_code;
  if (existing) return res.json({ invite_code: existing });

  // Collisions are astronomically unlikely at 4 random bytes, but the unique constraint
  // means a retry is free insurance rather than a real failure mode to design hard for.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomBytes(4).toString('hex');
    try {
      const { rows: updated } = await pool.query(
        'UPDATE users SET invite_code = $1 WHERE id = $2 RETURNING invite_code',
        [code, req.userId],
      );
      return res.json({ invite_code: updated[0].invite_code });
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  return res.status(500).json({ error: 'internal_error' });
});

router.patch('/theme', requireAuth, async (req, res) => {
  const { theme } = req.body ?? {};
  if (!VALID_THEMES.includes(theme)) {
    return res.status(400).json({ error: 'invalid_theme' });
  }
  const { rows } = await pool.query(
    `UPDATE users SET theme = $1 WHERE id = $2 RETURNING ${USER_COLUMNS}`,
    [theme, req.userId],
  );
  return res.json({ user: userView(rows[0]) });
});

export default router;
