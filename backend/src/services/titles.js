import { pool } from '../db/pool.js';
import { ACHIEVEMENTS } from '../lib/achievements.js';
import { TITLES, TITLE_BY_ID, earnedTitleIds } from '../lib/titles.js';

const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** The ids of every title this player may wear: the ones their achievements earn, and the ones an admin granted. */
export async function heldTitleIds(userId) {
  const [{ rows: unlocked }, { rows: granted }] = await Promise.all([
    pool.query('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId]),
    pool.query('SELECT title_id FROM user_titles WHERE user_id = $1', [userId]),
  ]);
  const held = new Set(earnedTitleIds(new Set(unlocked.map((r) => r.achievement_id))));
  for (const { title_id: id } of granted) if (TITLE_BY_ID[id]?.kind === 'system') held.add(id);
  return held;
}

/**
 * What the picker shows: every earned title, with whether this player has it and what it takes if not,
 * and the system titles they have been granted. A system title they have not been given is not listed —
 * it is not something to aim for, so there is nothing to tell them about it.
 */
export async function describeTitles(userId) {
  const held = await heldTitleIds(userId);
  return TITLES.filter((t) => t.kind === 'earned' || held.has(t.id)).map((t) =>
    t.kind === 'earned'
      ? {
          id: t.id,
          name: t.name,
          kind: 'earned',
          held: held.has(t.id),
          requirement: ACHIEVEMENT_BY_ID[t.requires]?.description ?? '',
          achievement_name: ACHIEVEMENT_BY_ID[t.requires]?.name ?? t.requires,
        }
      : { id: t.id, name: t.name, kind: 'system', held: true, description: t.description },
  );
}

/** Gives a system title to a player. `granted: false` if they already had it; null if there is no such player. */
export async function grantTitle(adminId, username, titleId) {
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL', [username]);
  if (rows.length === 0) return null;
  const { rowCount } = await pool.query(
    'INSERT INTO user_titles (user_id, title_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [rows[0].id, titleId, adminId],
  );
  return { granted: rowCount > 0 };
}

/** Takes a granted title back, and off the player if they were wearing it. False if they did not have it. */
export async function revokeTitle(username, titleId) {
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL', [username]);
  if (rows.length === 0) return false;
  const { rowCount } = await pool.query('DELETE FROM user_titles WHERE user_id = $1 AND title_id = $2', [rows[0].id, titleId]);
  if (rowCount === 0) return false;
  await pool.query('UPDATE users SET title = NULL WHERE id = $1 AND title = $2', [rows[0].id, titleId]);
  return true;
}

export async function listHolders() {
  const { rows } = await pool.query(
    `SELECT u.username, ut.title_id AS title, g.username AS granted_by, ut.granted_at
     FROM user_titles ut
     JOIN users u ON u.id = ut.user_id AND u.deleted_at IS NULL
     LEFT JOIN users g ON g.id = ut.granted_by
     ORDER BY ut.granted_at DESC`,
  );
  return rows;
}
