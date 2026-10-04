import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { liftAction } from '../services/moderation.js';
import { displayNameSql } from '../lib/displayName.js';

const router = express.Router();

router.use(requireAuth);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// What a moderator has done to the signed-in player that they have not yet read: one entry per
// batch of actions, with the note written for them. Shown until acknowledged, so a warning cannot
// be missed by closing the tab.
router.get('/notices', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT batch_id, array_agg(action ORDER BY id) AS actions, max(note) AS note, max(days) AS days,
            min(created_at) AS created_at
     FROM moderation_actions
     WHERE user_id = $1 AND acknowledged_at IS NULL
     GROUP BY batch_id
     ORDER BY min(created_at)`,
    [req.userId],
  );
  return res.json({ notices: rows });
});

// A batch that is not yours, or does not exist, or is already acknowledged, is the same 404.
router.post('/notices/:batch/acknowledge', async (req, res) => {
  if (!UUID.test(req.params.batch)) return res.status(404).json({ error: 'notice_not_found' });
  const { rowCount } = await pool.query(
    `UPDATE moderation_actions SET acknowledged_at = now()
     WHERE batch_id = $1 AND user_id = $2 AND acknowledged_at IS NULL`,
    [req.params.batch, req.userId],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'notice_not_found' });
  return res.status(204).end();
});

// The log of everything done to players, newest first, for the moderators' screen — with whether a
// suspension or ban is still in force, so it can be lifted.
router.get('/actions', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ma.id, ma.batch_id, ma.action, ma.note, ma.days, ma.expires_at, ma.created_at, ma.lifted_at,
            ${displayNameSql('target')} AS username, admin.username AS admin_username,
            (ma.lifted_at IS NULL AND (ma.action = 'ban' OR (ma.action = 'suspend' AND ma.expires_at > now()))) AS active
     FROM moderation_actions ma
     JOIN users target ON target.id = ma.user_id
     JOIN users admin ON admin.id = ma.admin_id
     ORDER BY ma.created_at DESC, ma.id DESC
     LIMIT 100`,
  );
  return res.json({ actions: rows });
});

router.post('/actions/:id/lift', requireAdmin, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'action_not_found' });
  const result = await liftAction({ adminId: req.userId, actionId: Number(req.params.id) });
  if (result.error) return res.status(result.error.status).json(result.error.body);
  return res.status(204).end();
});

export default router;
