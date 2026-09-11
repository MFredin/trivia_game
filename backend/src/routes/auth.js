import express from 'express';
import { pool } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { signAuthToken } from '../lib/authTokens.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function userView(row) {
  return { id: row.id, username: row.username, email: row.email };
}

router.post('/register', async (req, res) => {
  const { email, username, password } = req.body ?? {};
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
       RETURNING id, username, email`,
      [username.trim(), email.toLowerCase().trim(), passwordHash],
    );
    const user = rows[0];
    return res.status(201).json({ token: signAuthToken(user.id), user: userView(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'email_or_username_taken' });
    }
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'invalid_request' });
  }

  const { rows } = await pool.query(
    'SELECT id, username, email, password_hash FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  );
  const user = rows[0];
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  return res.json({ token: signAuthToken(user.id), user: userView(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.userId]);
  if (rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
  return res.json({ user: userView(rows[0]) });
});

export default router;
