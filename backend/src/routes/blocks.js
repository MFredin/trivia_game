import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { blockUser } from '../services/blocks.js';

const router = express.Router();

router.use(requireAuth);

async function findUser(username) {
  const { rows } = await pool.query('SELECT id, username FROM users WHERE username = $1 AND deleted_at IS NULL', [username]);
  return rows[0] ?? null;
}

// Only the players the caller has blocked. Who has blocked the caller is never reported: a
// block that announces itself invites the retaliation it exists to prevent.
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.username, u.avatar, u.theme, b.created_at
     FROM blocks b
     JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id = $1
     ORDER BY b.created_at DESC`,
    [req.userId],
  );
  return res.json({ blocked: rows.map((r) => ({ username: r.username, avatar: r.avatar ?? null, theme: r.theme })) });
});

router.post('/', async (req, res) => {
  const { username } = req.body ?? {};
  if (typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'invalid_username' });
  }
  const target = await findUser(username.trim());
  if (!target) return res.status(404).json({ error: 'user_not_found' });
  if (target.id === req.userId) return res.status(400).json({ error: 'cannot_block_yourself' });

  await blockUser(req.userId, target.id);
  return res.status(204).end();
});

// Lifts the caller's own block only, and does not restore a friendship it ended.
router.delete('/:username', async (req, res) => {
  const target = await findUser(req.params.username);
  if (!target) return res.status(404).json({ error: 'user_not_found' });

  await pool.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.userId, target.id]);
  return res.status(204).end();
});

export default router;
