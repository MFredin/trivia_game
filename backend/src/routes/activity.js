import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const scope = req.query.scope === 'self' ? 'self' : 'friends';

  // "friends" (the default) includes the caller's own events too — a feed of "just you" would
  // be a strange default when the whole point is seeing friends' activity alongside your own.
  const condition =
    scope === 'self'
      ? 'ae.user_id = $1'
      : `(ae.user_id = $1 OR ae.user_id IN (SELECT friend_user_id FROM friendships WHERE user_id = $1 AND status = 'accepted'))`;

  const { rows } = await pool.query(
    `SELECT u.username, ae.type, ae.payload, ae.created_at
     FROM activity_events ae
     JOIN users u ON u.id = ae.user_id
     WHERE ${condition}
     ORDER BY ae.created_at DESC
     LIMIT $2`,
    [req.userId, limit],
  );

  return res.json({
    events: rows.map((r) => ({ username: r.username, type: r.type, payload: r.payload, created_at: r.created_at })),
  });
});

export default router;
