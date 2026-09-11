import { pool } from '../db/pool.js';
import { sendToUser } from '../lib/wsServer.js';
import { evaluateAchievements } from './achievements.js';

export async function getOpponentSession(duelId, userId) {
  const { rows } = await pool.query(`SELECT * FROM game_sessions WHERE duel_id = $1 AND user_id != $2`, [
    duelId,
    userId,
  ]);
  return rows[0] ?? null;
}

// Only fires once both linked game_sessions are completed — whichever answer completes the
// second one triggers this, regardless of which participant that was.
export async function maybeFinishDuel(duelId) {
  const { rows } = await pool.query(`SELECT * FROM game_sessions WHERE duel_id = $1`, [duelId]);
  if (rows.length < 2 || !rows.every((s) => s.status === 'completed')) return;

  const { rows: updated } = await pool.query(
    `UPDATE duels SET status = 'completed', completed_at = now() WHERE id = $1 AND status != 'completed' RETURNING id`,
    [duelId],
  );
  if (updated.length === 0) return; // already finished by a concurrent request

  const payload = {
    type: 'duel:finished',
    duel_id: duelId,
    results: rows.map((s) => ({ user_id: s.user_id, total_score: s.total_score })),
  };
  for (const s of rows) sendToUser(s.user_id, payload);
  for (const s of rows) await evaluateAchievements(s.user_id);
}
