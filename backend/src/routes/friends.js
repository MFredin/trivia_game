import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.username
     FROM friendships f
     JOIN users u ON u.id = f.friend_user_id
     WHERE f.user_id = $1
     ORDER BY u.username`,
    [req.userId],
  );
  return res.json({ friends: rows });
});

router.post('/', async (req, res) => {
  const { username } = req.body ?? {};
  if (typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'invalid_username' });
  }

  const { rows: targetRows } = await pool.query('SELECT id, username FROM users WHERE username = $1', [
    username.trim(),
  ]);
  const target = targetRows[0];
  if (!target) return res.status(404).json({ error: 'user_not_found' });
  if (target.id === req.userId) return res.status(400).json({ error: 'cannot_friend_yourself' });

  await pool.query(
    `INSERT INTO friendships (user_id, friend_user_id) VALUES ($1, $2)
     ON CONFLICT (user_id, friend_user_id) DO NOTHING`,
    [req.userId, target.id],
  );
  return res.status(201).json({ friend: target });
});

router.delete('/:username', async (req, res) => {
  await pool.query(
    `DELETE FROM friendships
     WHERE user_id = $1 AND friend_user_id = (SELECT id FROM users WHERE username = $2)`,
    [req.userId, req.params.username],
  );
  return res.status(204).end();
});

export default router;
