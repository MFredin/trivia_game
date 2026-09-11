import express from 'express';
import { pool } from '../db/pool.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const mode = req.query.mode === 'daily' ? 'daily' : 'classic';
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const { rows } = await pool.query(
    `SELECT u.username, gs.total_score, gs.category, gs.canon_source, gs.completed_at
     FROM game_sessions gs
     JOIN users u ON u.id = gs.user_id
     WHERE gs.mode = $1 AND gs.status = 'completed'
     ORDER BY gs.total_score DESC, gs.completed_at ASC
     LIMIT $2`,
    [mode, limit],
  );

  return res.json({ mode, entries: rows });
});

export default router;
