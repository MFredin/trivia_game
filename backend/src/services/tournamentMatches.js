// Deciding tournament matches and moving a bracket on (docs/tournament-brackets-plan.md).
//
// There is exactly ONE way a match is decided: decideMatchIfReady. The last run of a match finishing calls it, the deadline
// sweep calls it, and an account that has gone calls it; none of them decides anything itself. That is the lesson of the
// duplicate pending duels and the double achievement toast: advancing state needs one gate that is safe to call twice, not
// several paths that each believe they arrived first.
//
// The gate runs in one transaction that takes a row lock on the TOURNAMENT first and the match second, always in that
// order, so two calls for the same match, or for two matches of one round, queue up instead of both advancing the round.

import { pool } from '../db/pool.js';
import { inTransaction } from '../db/transaction.js';
import { decideMatch, isFinal, pairNextRound } from '../lib/bracket.js';
import { deadlineFrom, lobbyExpired, overdue } from '../lib/tournamentRules.js';
import { recordActivity } from './activity.js';

const SWEEP_INTERVAL_MS = 60 * 1000;
// Any constant will do; it only has to be the same in every process so two instances do not both sweep at once.
const SWEEP_LOCK_KEY = 726_001;

/** The accounts among `ids` that can no longer play: deleted, banned or currently suspended. */
async function unavailable(client, ids, now) {
  const { rows } = await client.query(
    `SELECT id FROM users
     WHERE id = ANY($1) AND (deleted_at IS NOT NULL OR banned_at IS NOT NULL OR suspended_until > $2)`,
    [ids.filter(Boolean), now],
  );
  return new Set(rows.map((r) => r.id));
}

/** Whether two players have a block between them, either way. */
async function blocked(client, a, b) {
  const { rows } = await client.query(
    `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1`,
    [a, b],
  );
  return rows.length > 0;
}

/**
 * Creates the matches of a round, opening each with a deadline. A pair of players who have blocked each other is not
 * asked to play: the match is decided at once as a forfeit to the better seed, and nothing tells the other player why.
 * (Refusing a join over a block would reveal who has blocked whom, which the rest of the app avoids.)
 */
export async function openRound(client, tournament, matches, now) {
  const seeds = new Map(
    (await client.query('SELECT user_id, seed FROM tournament_players WHERE tournament_id = $1', [tournament.id])).rows.map((r) => [r.user_id, r.seed]),
  );
  const deadline = deadlineFrom(now, tournament.round_hours);
  for (const m of matches) {
    if (m.isBye) {
      await client.query(
        `INSERT INTO tournament_matches (tournament_id, round, slot, player_a, player_b, is_bye, status, winner_id, decided_by, decided_at)
         VALUES ($1, $2, $3, $4, $5, true, 'decided', $6, 'bye', $7)`,
        [tournament.id, m.round, m.slot, m.playerA, m.playerB, m.playerA ?? m.playerB, now],
      );
    } else if (await blocked(client, m.playerA, m.playerB)) {
      const winner = seeds.get(m.playerA) <= seeds.get(m.playerB) ? m.playerA : m.playerB;
      await client.query(
        `INSERT INTO tournament_matches (tournament_id, round, slot, player_a, player_b, status, winner_id, decided_by, decided_at)
         VALUES ($1, $2, $3, $4, $5, 'decided', $6, 'forfeit', $7)`,
        [tournament.id, m.round, m.slot, m.playerA, m.playerB, winner, now],
      );
      await client.query('UPDATE tournament_players SET eliminated_in_round = $3 WHERE tournament_id = $1 AND user_id = $2', [
        tournament.id, winner === m.playerA ? m.playerB : m.playerA, m.round,
      ]);
    } else {
      await client.query(
        `INSERT INTO tournament_matches (tournament_id, round, slot, player_a, player_b, status, deadline)
         VALUES ($1, $2, $3, $4, $5, 'open', $6)`,
        [tournament.id, m.round, m.slot, m.playerA, m.playerB, deadline],
      );
    }
  }
}

/**
 * If every match of the current round is decided, moves the bracket on: the next round is created, or, after the final,
 * the tournament is completed. Returns `{ completed, winnerId }` when it completed one, else `{ completed: false }`.
 * Called with the tournament row already locked.
 */
export async function advanceRoundIfComplete(client, tournament, now) {
  const { rows: round } = await client.query('SELECT * FROM tournament_matches WHERE tournament_id = $1 AND round = $2 ORDER BY slot', [
    tournament.id, tournament.current_round,
  ]);
  if (round.length === 0 || round.some((m) => m.status !== 'decided')) return { completed: false };

  if (isFinal(tournament.current_round, tournament.bracket_size)) {
    const winnerId = round[0].winner_id;
    await client.query(`UPDATE tournaments SET status = 'completed', winner_id = $2, completed_at = $3 WHERE id = $1`, [tournament.id, winnerId, now]);
    return { completed: true, winnerId };
  }

  const next = pairNextRound(round.map((m) => ({ round: m.round, slot: m.slot, winnerId: m.winner_id })));
  const advanced = { ...tournament, current_round: tournament.current_round + 1 };
  await client.query('UPDATE tournaments SET current_round = $2 WHERE id = $1', [tournament.id, advanced.current_round]);
  await openRound(client, advanced, next, now);
  // A whole round can be decided on creation (a block, say); if so there is nothing to wait for.
  return advanceRoundIfComplete(client, advanced, now);
}

/**
 * Decides a match if it is ready to be decided, and does nothing if it is not or has already been. Safe to call any
 * number of times, from anywhere.
 *
 * Ready means one of: both players have finished their runs; the deadline has passed; or a player can no longer play
 * (deleted, banned or suspended), in which case the other advances as a forfeit. At the deadline a run counts with the
 * answers given so far, but only if at least one question was answered: opening a match is not turning up.
 */
export async function decideMatchIfReady(matchId, { now = new Date() } = {}) {
  const result = await inTransaction(async (client) => {
    const first = (await client.query('SELECT tournament_id FROM tournament_matches WHERE id = $1', [matchId])).rows[0];
    if (!first) return null;
    const tournament = (await client.query('SELECT * FROM tournaments WHERE id = $1 FOR UPDATE', [first.tournament_id])).rows[0];
    const match = (await client.query('SELECT * FROM tournament_matches WHERE id = $1 FOR UPDATE', [matchId])).rows[0];
    if (!match || match.status !== 'open' || tournament.status !== 'running') return null;

    const { rows: runs } = await client.query(
      `SELECT gs.user_id, gs.status, gs.total_score, gs.created_at, gs.completed_at,
              (SELECT count(*) FROM session_questions sq WHERE sq.session_id = gs.id AND sq.answered_at IS NOT NULL)::int AS answered
       FROM game_sessions gs WHERE gs.tournament_match_id = $1`,
      [matchId],
    );
    const resultOf = (userId) => {
      const run = runs.find((r) => r.user_id === userId);
      if (!run || run.answered === 0) return null;
      return { score: run.total_score, totalMs: new Date(run.completed_at ?? now) - new Date(run.created_at), finished: run.status === 'completed' };
    };
    const resultA = resultOf(match.player_a);
    const resultB = resultOf(match.player_b);

    const gone = await unavailable(client, [match.player_a, match.player_b], now);
    const bothFinished = Boolean(resultA?.finished && resultB?.finished);
    if (!bothFinished && !overdue(match, now) && gone.size === 0) return null;

    const seeds = new Map(
      (await client.query('SELECT user_id, seed FROM tournament_players WHERE tournament_id = $1 AND user_id = ANY($2)', [tournament.id, [match.player_a, match.player_b]])).rows.map((r) => [r.user_id, r.seed]),
    );
    const seedA = seeds.get(match.player_a);
    const seedB = seeds.get(match.player_b);

    let winner;
    let decidedBy;
    if (gone.size > 0) {
      // Whoever can still play advances; if neither can, the better seed does.
      const aGone = gone.has(match.player_a);
      const bGone = gone.has(match.player_b);
      winner = aGone && !bGone ? 'b' : bGone && !aGone ? 'a' : seedA <= seedB ? 'a' : 'b';
      decidedBy = 'forfeit';
    } else {
      ({ winner, decidedBy } = decideMatch({ resultA, resultB, seedA, seedB }));
    }

    const winnerId = winner === 'a' ? match.player_a : match.player_b;
    const loserId = winner === 'a' ? match.player_b : match.player_a;
    await client.query(`UPDATE tournament_matches SET status = 'decided', winner_id = $2, decided_by = $3, decided_at = $4 WHERE id = $1`, [matchId, winnerId, decidedBy, now]);
    await client.query('UPDATE tournament_players SET eliminated_in_round = $3 WHERE tournament_id = $1 AND user_id = $2', [tournament.id, loserId, match.round]);

    const advance = await advanceRoundIfComplete(client, tournament, now);
    return { tournament, winnerId, advance };
  });

  // After the commit, so a failure to write the feed entry can never undo a decided match.
  if (result?.advance.completed) {
    await recordActivity(result.advance.winnerId, 'tournament_win', { tournament_name: result.tournament.name }).catch(() => {});
  }
  return result ? { decided: true, winnerId: result.winnerId } : { decided: false };
}

/**
 * One pass of the sweep: decides every match that is due and cancels lobbies nobody started. Only one process runs it at
 * a time (a Postgres advisory lock), so two instances during a deploy cannot both advance a round. Returns how many
 * matches it decided.
 */
export async function sweepTournaments(now = new Date()) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [SWEEP_LOCK_KEY]);
    if (!rows[0].locked) return 0;
    try {
      const { rows: due } = await client.query(
        `SELECT m.id FROM tournament_matches m
         LEFT JOIN users ua ON ua.id = m.player_a
         LEFT JOIN users ub ON ub.id = m.player_b
         WHERE m.status = 'open'
           AND (m.deadline <= $1
                OR ua.deleted_at IS NOT NULL OR ua.banned_at IS NOT NULL OR ua.suspended_until > $1
                OR ub.deleted_at IS NOT NULL OR ub.banned_at IS NOT NULL OR ub.suspended_until > $1)`,
        [now],
      );
      let decided = 0;
      for (const { id } of due) {
        if ((await decideMatchIfReady(id, { now })).decided) decided += 1;
      }

      const { rows: stale } = await client.query(`SELECT id, created_at FROM tournaments WHERE status = 'open'`);
      const expired = stale.filter((t) => lobbyExpired(new Date(t.created_at), now)).map((t) => t.id);
      if (expired.length > 0) await client.query(`UPDATE tournaments SET status = 'cancelled' WHERE id = ANY($1) AND status = 'open'`, [expired]);
      return decided;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [SWEEP_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

// No job runner is needed at this scale: the same housekeeping-timer pattern as services/retention.js. unref() so it
// never keeps a process (or a test run) alive.
setInterval(() => sweepTournaments().catch(() => {}), SWEEP_INTERVAL_MS).unref();
