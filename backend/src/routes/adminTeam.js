import express from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { roleOf } from '../lib/roles.js';
import { titleView } from '../lib/titles.js';
import { grantTitle, revokeTitle } from '../services/titles.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Who is on the team: admins and moderators, and the title each wears. Admins are made in the database
// by whoever runs the service (there is deliberately no route for it); moderators are made here.
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT username, is_admin, is_moderator, title FROM users
     WHERE (is_admin OR is_moderator) AND deleted_at IS NULL
     ORDER BY is_admin DESC, username`,
  );
  return res.json({ team: rows.map((r) => ({ username: r.username, role: roleOf(r), title: titleView(r.title) })) });
});

// Make someone a moderator, or take it back. An admin's role is not changed here. Making a moderator can
// give the Prefect title with it; taking the role back takes that title back too, so a label that says
// someone keeps order does not outlive their doing so.
router.post('/', async (req, res) => {
  const { username, role, give_title: giveTitle } = req.body ?? {};
  if (role !== 'moderator' && role !== 'player') return res.status(400).json({ error: 'invalid_role' });
  if (typeof username !== 'string' || username.trim() === '') return res.status(400).json({ error: 'invalid_username' });

  const { rows } = await pool.query('SELECT id, is_admin FROM users WHERE username = $1 AND deleted_at IS NULL', [username.trim()]);
  if (rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
  if (rows[0].is_admin) return res.status(400).json({ error: 'cannot_change_admin' });

  await pool.query('UPDATE users SET is_moderator = $2 WHERE id = $1', [rows[0].id, role === 'moderator']);
  if (role === 'moderator' && giveTitle === true) await grantTitle(req.userId, username.trim(), 'prefect');
  if (role === 'player') await revokeTitle(username.trim(), 'prefect');
  return res.json({ ok: true });
});

export default router;
