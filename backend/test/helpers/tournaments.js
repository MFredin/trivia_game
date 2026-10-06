// What the tournament tests share: building a started tournament, and recording a player's run of a match directly, so a
// test can decide who won without depending on which of the random answer choices happened to be right.
import { call, json, newPlayer } from './app.js';

export const makePlayers = (n) => Promise.all(Array.from({ length: n }, () => newPlayer()));

/** Creates a tournament as `creator`, has `others` join, and starts it. Returns its code and the creator's view of it. */
export async function startedTournament(creator, others, settings = {}) {
  const made = await call('/tournaments', { method: 'POST', token: creator.token, body: json({ name: 'Test Cup', size: 16, ...settings }) });
  if (made.status !== 201) throw new Error(`create failed: ${JSON.stringify(made.body)}`);
  const { code } = made.body;
  for (const player of others) {
    const joined = await call('/tournaments/join', { method: 'POST', token: player.token, body: json({ code }) });
    if (joined.status !== 200) throw new Error(`join failed: ${JSON.stringify(joined.body)}`);
  }
  const started = await call(`/tournaments/${code}/start`, { method: 'POST', token: creator.token });
  if (started.status !== 200) throw new Error(`start failed: ${JSON.stringify(started.body)}`);
  return { code, view: (await view(creator, code)).body };
}

export const view = (player, code) => call(`/tournaments/${code}`, { token: player.token });

/** The matches of a tournament as the creator sees them, optionally one round of them. */
export async function matchesOf(player, code, round) {
  const { body } = await view(player, code);
  return round ? body.matches.filter((m) => m.round === round) : body.matches;
}

/**
 * Records a player's run of a match without playing it: a completed session with a score, a total time and one answered
 * question (a run with no answers does not count as having turned up).
 */
export async function recordRun(pool, matchId, player, { score, ms = 60000, completed = true, flagged = false }) {
  const { rows: [session] } = await pool.query(
    `INSERT INTO game_sessions (user_id, mode, canon_source, question_count, time_limit_ms, status, total_score,
                                tournament_match_id, created_at, completed_at, flagged_for_review)
     VALUES ($1, 'tournament', 'combined', 10, 30000, $2, $3, $4, now() - ($5 || ' milliseconds')::interval,
             CASE WHEN $2 = 'completed' THEN now() END, $6)
     RETURNING id`,
    [player.id, completed ? 'completed' : 'active', score, matchId, String(ms), flagged],
  );
  const { rows: [q] } = await pool.query('SELECT id FROM questions LIMIT 1');
  await pool.query(
    `INSERT INTO session_questions (session_id, position, question_id, choice_order, correct_choice_index, answered_at, chosen_index, correct, points)
     VALUES ($1, 0, $2, '{0,1,2,3}', 0, now(), 0, true, $3)`,
    [session.id, q.id, score],
  );
  return session.id;
}

/** Names the user a match slot holds, by the usernames in `players`. */
export const playerNamed = (players, username) => players.find((p) => p.username === username);

/** Which of `players` is on a match's side 'a' or 'b'. */
export const sideOf = (match, players, side) => playerNamed(players, match[side === 'a' ? 'player_a' : 'player_b']?.username);

/** Deletes everything a test made for these players, children first, so the shared database stays clean. */
export async function cleanup(pool, players, codes) {
  const ids = players.map((p) => p.id);
  const { rows: tournaments } = await pool.query('SELECT id FROM tournaments WHERE code = ANY($1) OR created_by = ANY($2)', [codes, ids]);
  const tids = tournaments.map((t) => t.id);
  const { rows: sessions } = await pool.query('SELECT id FROM game_sessions WHERE user_id = ANY($1)', [ids]);
  const sids = sessions.map((s) => s.id);
  await pool.query('DELETE FROM session_questions WHERE session_id = ANY($1)', [sids]);
  await pool.query('DELETE FROM game_sessions WHERE id = ANY($1)', [sids]);
  await pool.query('DELETE FROM tournament_matches WHERE tournament_id = ANY($1)', [tids]);
  await pool.query('DELETE FROM tournament_players WHERE tournament_id = ANY($1) OR user_id = ANY($2)', [tids, ids]);
  await pool.query('UPDATE tournaments SET winner_id = NULL WHERE id = ANY($1)', [tids]);
  await pool.query('DELETE FROM tournaments WHERE id = ANY($1)', [tids]);
  await pool.query('DELETE FROM activity_events WHERE user_id = ANY($1)', [ids]);
}
