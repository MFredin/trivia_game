// A tournament's life: created, joined, started, played, cancelled (docs/tournament-brackets-plan.md). Deciding matches and
// moving rounds on is in services/tournamentMatches.js; the shape of the bracket is in lib/bracket.js.
//
// Functions return `{ error: 'code' }` for something the caller did wrong, and a value for success, so a route can turn the
// code into a status without a try/catch. Every function that names a tournament by its code answers `not_found` to anyone
// who is not in it, so a code cannot be used to find out whether a tournament exists.

import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { inTransaction } from '../db/transaction.js';
import { displayNameSql } from '../lib/displayName.js';
import { MODES } from '../lib/modes.js';
import { buildFirstRound, bracketSizeFor, seedPlayers } from '../lib/bracket.js';
import { contactAllowed } from '../lib/contactModes.js';
import { currentLeaderboardWindow } from '../lib/leaderboardWindow.js';
import { joinCheck, startCheck, validateCreate } from '../lib/tournamentRules.js';
import { getAllQuestions } from '../repo/questions.js';
import { pickNextQuestion, serveQuestion } from './sessionQuestions.js';
import { isBlockedEitherWay } from './blocks.js';
import { advanceRoundIfComplete, openRound } from './tournamentMatches.js';

async function areFriends(client, a, b) {
  const { rows } = await client.query(
    `SELECT 1 FROM friendships WHERE user_id = $1 AND friend_user_id = $2 AND status = 'accepted'`,
    [a, b],
  );
  return rows.length > 0;
}

async function challengesSetting(client, userId) {
  const { rows } = await client.query('SELECT challenges FROM users WHERE id = $1', [userId]);
  return rows[0]?.challenges ?? 'open';
}

/** Creates a tournament and puts its creator in it. Returns `{ tournament }` or `{ error }`. */
export async function createTournament(userId, body) {
  const checked = validateCreate(body);
  if (checked.error) return { error: checked.error };
  const s = checked.value;
  // Challenges set to Off means no challenges either way, and a tournament is a string of them.
  if ((await challengesSetting(pool, userId)) === 'off') return { error: 'challenges_off' };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomBytes(4).toString('hex');
    try {
      return await inTransaction(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO tournaments (code, created_by, name, size, category, canon_source, obscurity_filter, round_hours)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [code, userId, s.name, s.size, s.category, s.canonSource, s.difficulty, s.roundHours],
        );
        await client.query('INSERT INTO tournament_players (tournament_id, user_id) VALUES ($1, $2)', [rows[0].id, userId]);
        return { tournament: rows[0] };
      });
    } catch (err) {
      if (err.code !== '23505') throw err; // a collision on the code: try another
    }
  }
  return { error: 'internal_error' };
}

/** Joins by code. Returns `{ tournament }` or `{ error }`. */
export async function joinTournament(userId, code) {
  return inTransaction(async (client) => {
    const t = (await client.query('SELECT * FROM tournaments WHERE code = $1 FOR UPDATE', [code])).rows[0];
    if (!t) return { error: 'not_found' };
    // Joining is refused as "not found" when either side has blocked the other, so the answer cannot reveal a block.
    if (await isBlockedEitherWay(userId, t.created_by)) return { error: 'not_found' };

    const friends = await areFriends(client, userId, t.created_by);
    const mine = await challengesSetting(client, userId);
    const theirs = await challengesSetting(client, t.created_by);
    if (!contactAllowed(mine, friends) || !contactAllowed(theirs, friends)) return { error: 'cannot_join' };

    const { rows: players } = await client.query('SELECT user_id FROM tournament_players WHERE tournament_id = $1', [t.id]);
    const check = joinCheck({
      status: t.status,
      size: t.size,
      playerCount: players.length,
      alreadyIn: players.some((p) => p.user_id === userId),
    });
    if (!check.ok) return { error: check.reason };

    await client.query('INSERT INTO tournament_players (tournament_id, user_id) VALUES ($1, $2)', [t.id, userId]);
    return { tournament: t };
  });
}

/** Finds a tournament by code only for someone in it, locking the row. Returns the row, or null. */
async function loadMine(client, userId, code, { lock = false } = {}) {
  const { rows } = await client.query(
    `SELECT t.* FROM tournaments t
     WHERE t.code = $1 AND EXISTS (SELECT 1 FROM tournament_players p WHERE p.tournament_id = t.id AND p.user_id = $2)
     ${lock ? 'FOR UPDATE OF t' : ''}`,
    [code, userId],
  );
  return rows[0] ?? null;
}

/** Leaves an open tournament. Once it has started there is nothing to leave: not playing a match is the same thing. */
export async function leaveTournament(userId, code) {
  return inTransaction(async (client) => {
    const t = await loadMine(client, userId, code, { lock: true });
    if (!t) return { error: 'not_found' };
    if (t.status !== 'open') return { error: 'already_started' };
    if (t.created_by === userId) return { error: 'creator_cannot_leave' };
    await client.query('DELETE FROM tournament_players WHERE tournament_id = $1 AND user_id = $2', [t.id, userId]);
    return { ok: true };
  });
}

/** The creator removes a player from an open tournament. */
export async function removePlayer(creatorId, code, username) {
  return inTransaction(async (client) => {
    const t = await loadMine(client, creatorId, code, { lock: true });
    if (!t) return { error: 'not_found' };
    if (t.created_by !== creatorId) return { error: 'not_creator' };
    if (t.status !== 'open') return { error: 'already_started' };
    const { rows } = await client.query(
      `DELETE FROM tournament_players p USING users u
       WHERE p.tournament_id = $1 AND p.user_id = u.id AND u.username = $2 AND p.user_id <> $3
       RETURNING p.user_id`,
      [t.id, username, creatorId],
    );
    return rows.length === 0 ? { error: 'player_not_found' } : { ok: true };
  });
}

/** Seeds the players, draws the bracket and opens round one. Creator only. */
export async function startTournament(userId, code, now = new Date()) {
  return inTransaction(async (client) => {
    const t = await loadMine(client, userId, code, { lock: true });
    if (!t) return { error: 'not_found' };
    if (t.created_by !== userId) return { error: 'not_creator' };

    const { rows: players } = await client.query('SELECT user_id FROM tournament_players WHERE tournament_id = $1', [t.id]);
    const check = startCheck({ status: t.status, playerCount: players.length });
    if (!check.ok) return { error: check.reason };

    const seeded = seedPlayers(players.map((p) => p.user_id), t.id);
    for (let i = 0; i < seeded.length; i++) {
      await client.query('UPDATE tournament_players SET seed = $3 WHERE tournament_id = $1 AND user_id = $2', [t.id, seeded[i], i + 1]);
    }

    const running = { ...t, status: 'running', bracket_size: bracketSizeFor(seeded.length), current_round: 1 };
    await client.query(
      `UPDATE tournaments SET status = 'running', bracket_size = $2, current_round = 1, started_at = $3 WHERE id = $1`,
      [t.id, running.bracket_size, now],
    );
    await openRound(client, running, buildFirstRound(seeded), now);
    await advanceRoundIfComplete(client, running, now);
    return { tournament: running };
  });
}

/** Cancels a tournament: its creator, or a moderator or admin. Anyone else in it may not; anyone not in it gets not_found. */
export async function cancelTournament(userId, code, { isStaff = false } = {}) {
  return inTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM tournaments WHERE code = $1 FOR UPDATE', [code]);
    const t = rows[0];
    const inIt = t && Boolean((await loadMine(client, userId, code)));
    if (!t || (!inIt && !isStaff)) return { error: 'not_found' };
    if (t.created_by !== userId && !isStaff) return { error: 'not_creator' };
    if (t.status === 'completed' || t.status === 'cancelled') return { error: 'already_over' };
    await client.query(`UPDATE tournaments SET status = 'cancelled' WHERE id = $1`, [t.id]);
    return { ok: true };
  });
}

/**
 * Starts the caller's run of a match. The run is dealt the match's questions, the same for both players. One run per player
 * per match: the unique index refuses a second, so a double click or a second tab cannot start another.
 * Returns the same payload a challenge run starts with, or `{ error }`.
 */
export async function startMatchRun(userId, matchId, now = new Date()) {
  const { rows } = await pool.query(
    `SELECT m.*, t.status AS tournament_status, t.category, t.canon_source, t.obscurity_filter
     FROM tournament_matches m JOIN tournaments t ON t.id = m.tournament_id
     WHERE m.id = $1 AND (m.player_a = $2 OR m.player_b = $2)`,
    [matchId, userId],
  );
  const match = rows[0];
  if (!match) return { error: 'match_not_found' };
  if (match.tournament_status !== 'running' || match.status !== 'open') return { error: 'match_not_open' };
  if (match.deadline <= now) return { error: 'match_closed' };

  const mode = MODES.tournament;
  let session;
  try {
    ({ rows: [session] } = await pool.query(
      `INSERT INTO game_sessions
        (user_id, mode, category, canon_source, obscurity_filter, question_count, time_limit_ms, tournament_match_id, leaderboard_window)
       VALUES ($1, 'tournament', $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId, match.category, match.canon_source, match.obscurity_filter, mode.questionCount, mode.timeLimitMs, matchId, currentLeaderboardWindow()],
    ));
  } catch (err) {
    if (err.code === '23505') return { error: 'already_started' };
    throw err;
  }

  const first = pickNextQuestion({ session, questions: await getAllQuestions(), position: 0, excludeIds: new Set() });
  if (!first) return { error: 'no_eligible_questions' };
  const { question, token, issued_at: issuedAt } = await serveQuestion({ session, question: first, position: 0 });
  return {
    run: {
      session_id: session.id,
      mode: session.mode,
      category: session.category,
      canon_source: session.canon_source,
      difficulty: session.obscurity_filter,
      question_count: session.question_count,
      time_limit_ms: session.time_limit_ms,
      timing_mode: mode.timingMode,
      max_strikes: mode.maxStrikes,
      created_at: session.created_at,
      question,
      token,
      issued_at: issuedAt,
    },
  };
}

/** One match as the screen needs it. Scores are shown only once a match is decided, so nobody plays knowing the target. */
function matchView(m, runs, viewerId) {
  const runOf = (id) => runs.find((r) => r.tournament_match_id === m.id && r.user_id === id);
  const decided = m.status === 'decided';
  const side = (id, username, seed) => (id ? { username, seed, is_me: id === viewerId } : null);
  const mine = [m.player_a, m.player_b].includes(viewerId) ? runOf(viewerId) : null;
  const myState = ![m.player_a, m.player_b].includes(viewerId) || m.is_bye || decided
    ? null
    : !mine ? 'to_play' : mine.status === 'completed' ? 'finished' : 'started';
  return {
    id: m.id,
    round: m.round,
    slot: m.slot,
    status: m.status,
    is_bye: m.is_bye,
    deadline: m.deadline,
    player_a: side(m.player_a, m.name_a, m.seed_a),
    player_b: side(m.player_b, m.name_b, m.seed_b),
    winner: !decided ? null : m.winner_id === m.player_a ? 'a' : 'b',
    decided_by: m.decided_by,
    score_a: decided && !m.is_bye ? runOf(m.player_a)?.total_score ?? null : null,
    score_b: decided && !m.is_bye ? runOf(m.player_b)?.total_score ?? null : null,
    // A flagged run is reported rather than silently counted, so the organiser can decide to cancel and replay.
    under_review: [m.player_a, m.player_b].some((id) => id && runOf(id)?.flagged_for_review),
    my_state: myState,
  };
}

/** The whole tournament for someone in it, or `{ error: 'not_found' }`. */
export async function getTournament(userId, code) {
  const t = await loadMine(pool, userId, code);
  if (!t) return { error: 'not_found' };

  const [{ rows: players }, { rows: matches }, { rows: runs }] = await Promise.all([
    pool.query(
      `SELECT p.user_id, p.seed, p.eliminated_in_round, ${displayNameSql('u')} AS username
       FROM tournament_players p JOIN users u ON u.id = p.user_id
       WHERE p.tournament_id = $1 ORDER BY p.seed NULLS LAST, p.joined_at`,
      [t.id],
    ),
    pool.query(
      `SELECT m.*, ${displayNameSql('ua')} AS name_a, ${displayNameSql('ub')} AS name_b, pa.seed AS seed_a, pb.seed AS seed_b
       FROM tournament_matches m
       LEFT JOIN users ua ON ua.id = m.player_a LEFT JOIN users ub ON ub.id = m.player_b
       LEFT JOIN tournament_players pa ON pa.tournament_id = m.tournament_id AND pa.user_id = m.player_a
       LEFT JOIN tournament_players pb ON pb.tournament_id = m.tournament_id AND pb.user_id = m.player_b
       WHERE m.tournament_id = $1 ORDER BY m.round, m.slot`,
      [t.id],
    ),
    pool.query(
      `SELECT gs.tournament_match_id, gs.user_id, gs.status, gs.total_score, gs.flagged_for_review
       FROM game_sessions gs JOIN tournament_matches m ON m.id = gs.tournament_match_id WHERE m.tournament_id = $1`,
      [t.id],
    ),
  ]);
  const nameOf = (id) => players.find((p) => p.user_id === id)?.username ?? null;

  return {
    tournament: {
      code: t.code,
      name: t.name,
      status: t.status,
      size: t.size,
      bracket_size: t.bracket_size,
      round_hours: t.round_hours,
      current_round: t.current_round,
      category: t.category,
      canon_source: t.canon_source,
      difficulty: t.obscurity_filter,
      created_by: nameOf(t.created_by),
      is_creator: t.created_by === userId,
      winner: t.winner_id ? nameOf(t.winner_id) : null,
      players: players.map((p) => ({ username: p.username, seed: p.seed, eliminated_in_round: p.eliminated_in_round, is_me: p.user_id === userId })),
      matches: matches.map((m) => matchView(m, runs, userId)),
    },
  };
}

/** The tournaments the caller is in, newest first, each with what they have to do next. */
export async function listMine(userId) {
  const { rows } = await pool.query(
    `SELECT t.code, t.name, t.status, t.size, t.current_round, ${displayNameSql('w')} AS winner,
            (SELECT count(*)::int FROM tournament_players p WHERE p.tournament_id = t.id) AS player_count,
            (SELECT min(m.deadline) FROM tournament_matches m
              WHERE m.tournament_id = t.id AND m.status = 'open' AND (m.player_a = $1 OR m.player_b = $1)
                AND NOT EXISTS (SELECT 1 FROM game_sessions gs WHERE gs.tournament_match_id = m.id AND gs.user_id = $1 AND gs.status = 'completed')
            ) AS my_deadline
     FROM tournaments t
     JOIN tournament_players mine ON mine.tournament_id = t.id AND mine.user_id = $1
     LEFT JOIN users w ON w.id = t.winner_id
     ORDER BY t.created_at DESC`,
    [userId],
  );
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    status: r.status,
    size: r.size,
    player_count: r.player_count,
    current_round: r.current_round,
    winner: r.winner,
    my_deadline: r.my_deadline,
  }));
}
