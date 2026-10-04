import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { isValidAvatar } from '../lib/avatars.js';
import { USER_COLUMNS, userView } from '../lib/userView.js';

const router = express.Router();

router.use(requireAuth);

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

export default router;
