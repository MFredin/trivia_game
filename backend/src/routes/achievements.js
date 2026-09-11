import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { ACHIEVEMENTS } from '../lib/achievements.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1', [
    req.userId,
  ]);
  const unlockedAt = new Map(rows.map((r) => [r.achievement_id, r.unlocked_at]));

  const achievements = ACHIEVEMENTS.map((def) => ({
    ...def,
    unlocked: unlockedAt.has(def.id),
    unlocked_at: unlockedAt.get(def.id) ?? null,
  }));

  return res.json({ achievements });
});

export default router;
