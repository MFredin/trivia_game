import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { ACHIEVEMENTS } from '../lib/achievements.js';
import { TITLES } from '../lib/titles.js';

const TITLE_FOR = Object.fromEntries(TITLES.filter((t) => t.kind === 'earned').map((t) => [t.requires, t.name]));

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1', [
    req.userId,
  ]);
  const unlockedAt = new Map(rows.map((r) => [r.achievement_id, r.unlocked_at]));

  const achievements = ACHIEVEMENTS.map((def) => ({
    ...def,
    // The title this one earns, if it earns one, so the screen can say what is waiting.
    title: TITLE_FOR[def.id] ?? null,
    unlocked: unlockedAt.has(def.id),
    unlocked_at: unlockedAt.get(def.id) ?? null,
  }));

  return res.json({ achievements });
});

export default router;
