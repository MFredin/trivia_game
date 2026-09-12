import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { isOnline } from '../lib/presenceRegistry.js';
import { evaluateAchievements } from '../services/achievements.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.username
     FROM friendships f
     JOIN users u ON u.id = f.friend_user_id
     WHERE f.user_id = $1 AND f.status = 'accepted'
     ORDER BY u.username`,
    [req.userId],
  );
  const friends = rows.map((f) => ({ ...f, online: isOnline(f.id) }));
  return res.json({ friends });
});

// Requests I've RECEIVED, awaiting my accept/decline.
router.get('/requests', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.username
     FROM friendships f
     JOIN users u ON u.id = f.user_id
     WHERE f.friend_user_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at`,
    [req.userId],
  );
  return res.json({ requests: rows });
});

// Requests I've SENT, still awaiting the other person.
router.get('/requests/sent', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.username
     FROM friendships f
     JOIN users u ON u.id = f.friend_user_id
     WHERE f.user_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at`,
    [req.userId],
  );
  return res.json({ requests: rows });
});

async function findUserByUsername(username) {
  const { rows } = await pool.query('SELECT id, username FROM users WHERE username = $1', [username]);
  return rows[0] ?? null;
}

// Lets a player find members to befriend (or challenge) by partial username, without already
// knowing their exact handle — separate from the exact-match lookup addFriend/createDuel use.
router.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) return res.json({ results: [] });

  const { rows } = await pool.query(
    `SELECT u.id, u.username, f_out.status AS outgoing_status, f_in.status AS incoming_status
     FROM users u
     LEFT JOIN friendships f_out ON f_out.user_id = $1 AND f_out.friend_user_id = u.id
     LEFT JOIN friendships f_in ON f_in.user_id = u.id AND f_in.friend_user_id = $1
     WHERE u.id != $1 AND u.username ILIKE $2
     ORDER BY u.username
     LIMIT 20`,
    [req.userId, `%${q}%`],
  );
  const results = rows.map((r) => ({
    id: r.id,
    username: r.username,
    online: isOnline(r.id),
    status:
      r.outgoing_status === 'accepted' || r.incoming_status === 'accepted'
        ? 'friends'
        : r.outgoing_status === 'pending'
          ? 'pending_sent'
          : r.incoming_status === 'pending'
            ? 'pending_received'
            : 'none',
  }));
  return res.json({ results });
});

router.post('/', async (req, res) => {
  const { username } = req.body ?? {};
  if (typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'invalid_username' });
  }

  const target = await findUserByUsername(username.trim());
  if (!target) return res.status(404).json({ error: 'user_not_found' });
  if (target.id === req.userId) return res.status(400).json({ error: 'cannot_friend_yourself' });

  const { rows: reverseRows } = await pool.query(
    `SELECT status FROM friendships WHERE user_id = $1 AND friend_user_id = $2`,
    [target.id, req.userId],
  );
  const reverse = reverseRows[0];

  if (reverse?.status === 'pending') {
    // They already asked us — accepting their request is a better experience than two
    // separate pending rows sitting unresolved in each direction.
    await pool.query(
      `UPDATE friendships SET status = 'accepted' WHERE user_id = $1 AND friend_user_id = $2`,
      [target.id, req.userId],
    );
    await pool.query(
      `INSERT INTO friendships (user_id, friend_user_id, status, requested_by)
       VALUES ($1, $2, 'accepted', $3)
       ON CONFLICT (user_id, friend_user_id) DO UPDATE SET status = 'accepted'`,
      [req.userId, target.id, target.id],
    );
    await evaluateAchievements(req.userId);
    await evaluateAchievements(target.id);
    return res.status(200).json({ friend: target, status: 'accepted' });
  }

  if (reverse?.status === 'accepted') {
    return res.status(409).json({ error: 'already_friends' });
  }

  const { rows: existingRows } = await pool.query(
    `SELECT status FROM friendships WHERE user_id = $1 AND friend_user_id = $2`,
    [req.userId, target.id],
  );
  if (existingRows[0]?.status === 'pending') {
    return res.status(409).json({ error: 'request_already_sent' });
  }
  if (existingRows[0]?.status === 'accepted') {
    return res.status(409).json({ error: 'already_friends' });
  }

  await pool.query(
    `INSERT INTO friendships (user_id, friend_user_id, status, requested_by)
     VALUES ($1, $2, 'pending', $1)
     ON CONFLICT (user_id, friend_user_id) DO UPDATE SET status = 'pending', requested_by = $1`,
    [req.userId, target.id],
  );
  return res.status(201).json({ friend: target, status: 'pending' });
});

router.post('/requests/:username/accept', async (req, res) => {
  const sender = await findUserByUsername(req.params.username);
  if (!sender) return res.status(404).json({ error: 'user_not_found' });

  const { rowCount } = await pool.query(
    `UPDATE friendships SET status = 'accepted' WHERE user_id = $1 AND friend_user_id = $2 AND status = 'pending'`,
    [sender.id, req.userId],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'request_not_found' });

  await pool.query(
    `INSERT INTO friendships (user_id, friend_user_id, status, requested_by)
     VALUES ($1, $2, 'accepted', $2)
     ON CONFLICT (user_id, friend_user_id) DO UPDATE SET status = 'accepted'`,
    [req.userId, sender.id],
  );
  await evaluateAchievements(req.userId);
  await evaluateAchievements(sender.id);
  return res.status(200).json({ friend: sender });
});

router.post('/requests/:username/decline', async (req, res) => {
  const sender = await findUserByUsername(req.params.username);
  if (!sender) return res.status(404).json({ error: 'user_not_found' });

  await pool.query(`DELETE FROM friendships WHERE user_id = $1 AND friend_user_id = $2 AND status = 'pending'`, [
    sender.id,
    req.userId,
  ]);
  return res.status(204).end();
});

router.delete('/:username', async (req, res) => {
  const target = await findUserByUsername(req.params.username);
  if (!target) return res.status(404).json({ error: 'user_not_found' });

  await pool.query(
    `DELETE FROM friendships
     WHERE (user_id = $1 AND friend_user_id = $2) OR (user_id = $2 AND friend_user_id = $1)`,
    [req.userId, target.id],
  );
  return res.status(204).end();
});

export default router;
