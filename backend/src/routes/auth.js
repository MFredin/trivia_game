import crypto from 'node:crypto';
import express from 'express';
import { pool } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { signAuthToken } from '../lib/authTokens.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimiter.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_THEMES = ['gryffindor', 'hufflepuff', 'slytherin', 'ravenclaw', 'monochrome'];

// Credential-stuffing/brute-force throttle — narrowly scoped to these two routes so normal
// gameplay traffic is never affected. Keyed by IP; see lib/rateLimiter.js for the tradeoffs.
const authRateLimit = rateLimit({ max: 10, windowMs: 15 * 60 * 1000 });

function userView(row) {
  return { id: row.id, username: row.username, email: row.email, theme: row.theme, is_admin: row.is_admin };
}

router.post('/register', authRateLimit, async (req, res) => {
  const { email, username, password, invite_code } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (typeof username !== 'string' || username.trim().length === 0 || username.length > 40) {
    return res.status(400).json({ error: 'invalid_username' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password_too_short' });
  }

  const passwordHash = hashPassword(password);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)
       RETURNING id, username, email, theme, is_admin`,
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

    return res.status(201).json({ token: signAuthToken(user.id), user: userView(user) });
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
    'SELECT id, username, email, password_hash, theme, is_admin FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  );
  const user = rows[0];
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  return res.json({ token: signAuthToken(user.id), user: userView(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, username, email, theme, is_admin FROM users WHERE id = $1', [
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
    'UPDATE users SET theme = $1 WHERE id = $2 RETURNING id, username, email, theme, is_admin',
    [theme, req.userId],
  );
  return res.json({ user: userView(rows[0]) });
});

export default router;
