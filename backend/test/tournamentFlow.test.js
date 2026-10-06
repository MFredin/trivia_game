import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, skip, settle } from './helpers/app.js';
import { cleanup, makePlayers, matchesOf, recordRun, sideOf, startedTournament, view } from './helpers/tournaments.js';

// A tournament played end to end against a real database: how it is drawn, how each match is decided, and how the bracket
// moves on. Results are written straight into the database so the winner of a match is known in advance; one test plays a
// match through the real routes to prove that a finished run decides it.
let pool;
let decideMatchIfReady;
let sweepTournaments;
const made = { players: [], codes: [] };

const open = { skip: skip && 'DATABASE_URL not set' };

test('tournament flow', open, async (t) => {
  ({ pool } = await boot());
  ({ decideMatchIfReady, sweepTournaments } = await import('../src/services/tournamentMatches.js'));
  t.after(async () => {
    await cleanup(pool, made.players, made.codes);
    await shutdown();
  });
  const players = async (n) => {
    const ps = await makePlayers(n);
    made.players.push(...ps);
    return ps;
  };
  const begin = async (creator, others, settings) => {
    const result = await startedTournament(creator, others, settings);
    made.codes.push(result.code);
    return result;
  };
  // The sweep takes an advisory lock; another test file's process may hold it for a moment, so ask again until done. It uses
  // the real clock, never a shifted one: the sweep looks at every tournament in the database, and test files run in parallel
  // against one, so a clock set ahead here would also expire other files' brand-new lobbies. The tests that need a deadline
  // to have passed set it in the past instead.
  const sweepUntil = async (done) => {
    for (let i = 0; i < 25; i++) {
      await sweepTournaments();
      if (await done()) return;
      await settle(100);
    }
    assert.fail('the sweep did not do what was expected');
  };
  // Plays a whole round: the player on side 'a' of every open match wins.
  const decideRound = async (creator, code, round) => {
    for (const m of (await matchesOf(creator, code, round)).filter((x) => x.status === 'open')) {
      const [a, b] = [sideOf(m, all, 'a'), sideOf(m, all, 'b')];
      await recordRun(pool, m.id, a, { score: 900 });
      await recordRun(pool, m.id, b, { score: 100 });
      assert.deepEqual(await decideMatchIfReady(m.id), { decided: true, winnerId: a.id });
    }
  };
  let all = [];

  await t.test('a four-player tournament is drawn into two matches, seeds 1 to 4, and every player can see it', async () => {
    const [creator, ...rest] = (all = await players(4));
    const { code, view: v } = await begin(creator, rest);
    assert.equal(v.status, 'running');
    assert.equal(v.bracket_size, 4);
    assert.equal(v.current_round, 1);
    assert.deepEqual(v.players.map((p) => p.seed).sort(), [1, 2, 3, 4]);
    assert.equal(v.matches.length, 2);
    assert.ok(v.matches.every((m) => m.status === 'open' && !m.is_bye && m.deadline), 'both are open with a deadline');
    for (const p of rest) assert.equal((await view(p, code)).status, 200);
    // Seeds 1 and 2 are on opposite halves of the draw, and 1 faces 4.
    const seeds = v.matches.map((m) => [m.player_a.seed, m.player_b.seed].sort());
    assert.deepEqual(seeds, [[1, 4], [2, 3]]);
  });

  await t.test('played to a winner: each round is decided, the next is made, and the champion is recorded', async () => {
    const [creator, ...rest] = (all = await players(4));
    const { code } = await begin(creator, rest);

    await decideRound(creator, code, 1);
    let v = (await view(creator, code)).body;
    assert.equal(v.current_round, 2, 'round two was made when round one finished');
    const final = v.matches.filter((m) => m.round === 2);
    assert.equal(final.length, 1);
    assert.ok(final[0].player_a && final[0].player_b, 'both finalists are placed');
    assert.equal(final[0].status, 'open');
    assert.equal(v.status, 'running');

    await decideRound(creator, code, 2);
    v = (await view(creator, code)).body;
    assert.equal(v.status, 'completed');
    const finalMatch = v.matches.find((m) => m.round === 2);
    assert.equal(v.winner, finalMatch.winner === 'a' ? finalMatch.player_a.username : finalMatch.player_b.username);
    const { rows } = await pool.query(`SELECT payload FROM activity_events WHERE type = 'tournament_win' AND user_id = ANY($1)`, [all.map((p) => p.id)]);
    assert.equal(rows.length, 1, 'one win is recorded, once');
    assert.equal(rows[0].payload.tournament_name, 'Test Cup');
    const dead = await pool.query('SELECT count(*)::int AS n FROM tournament_players WHERE tournament_id = (SELECT id FROM tournaments WHERE code = $1) AND eliminated_in_round IS NOT NULL', [code]);
    assert.equal(dead.rows[0].n, 3, 'everyone but the champion was knocked out');
  });

  await t.test('with three players the top seed has a bye and goes straight to the final', async () => {
    const [creator, ...rest] = (all = await players(3));
    const { code, view: v } = await begin(creator, rest);
    assert.equal(v.bracket_size, 4);
    const bye = v.matches.find((m) => m.is_bye);
    assert.ok(bye, 'there is a bye');
    assert.equal(bye.status, 'decided');
    assert.equal(bye.decided_by, 'bye');
    const holder = bye.player_a ?? bye.player_b;
    assert.equal(holder.seed, 1, 'the bye goes to the top seed');

    await decideRound(creator, code, 1);
    const final = (await matchesOf(creator, code, 2))[0];
    assert.equal(final.player_a.seed === 1 || final.player_b.seed === 1, true, 'seed 1 is in the final');
  });

  await t.test('ties go to the faster run, then to the better seed', async () => {
    const [creator, ...rest] = (all = await players(4));
    const { code } = await begin(creator, rest);
    const [m1, m2] = await matchesOf(creator, code, 1);

    const [a1, b1] = [sideOf(m1, all, 'a'), sideOf(m1, all, 'b')];
    await recordRun(pool, m1.id, a1, { score: 500, ms: 40000 });
    await recordRun(pool, m1.id, b1, { score: 500, ms: 20000 });
    await decideMatchIfReady(m1.id);
    const decided1 = (await matchesOf(creator, code, 1)).find((m) => m.id === m1.id);
    assert.equal(decided1.decided_by, 'time');
    assert.equal(decided1.winner, 'b', 'the faster run wins');

    const [a2, b2] = [sideOf(m2, all, 'a'), sideOf(m2, all, 'b')];
    await recordRun(pool, m2.id, a2, { score: 500, ms: 30000 });
    await recordRun(pool, m2.id, b2, { score: 500, ms: 30000 });
    await decideMatchIfReady(m2.id);
    const decided2 = (await matchesOf(creator, code, 1)).find((m) => m.id === m2.id);
    assert.equal(decided2.decided_by, 'seed');
    const better = decided2.player_a.seed < decided2.player_b.seed ? 'a' : 'b';
    assert.equal(decided2.winner, better, 'a dead heat goes to the better seed');
  });

  await t.test('a match is not decided while one player is still playing and the deadline has not come', async () => {
    const [creator, ...rest] = (all = await players(4));
    const { code } = await begin(creator, rest);
    const [m] = await matchesOf(creator, code, 1);
    await recordRun(pool, m.id, sideOf(m, all, 'a'), { score: 900 });
    assert.deepEqual(await decideMatchIfReady(m.id), { decided: false });
    await recordRun(pool, m.id, sideOf(m, all, 'b'), { score: 100, completed: false });
    assert.deepEqual(await decideMatchIfReady(m.id), { decided: false }, 'a run still in progress is not a finished run');
  });

  await t.test('at the deadline a run counts with the answers given so far; opening a match is not turning up', async () => {
    const [creator, ...rest] = (all = await players(4));
    const { code } = await begin(creator, rest);
    const [m1, m2] = await matchesOf(creator, code, 1);

    // Match one: one player answered some, the other did not turn up. The one who played advances.
    const [a1, b1] = [sideOf(m1, all, 'a'), sideOf(m1, all, 'b')];
    await recordRun(pool, m1.id, b1, { score: 300, completed: false });
    // Match two: nobody turned up. The better seed advances.
    await pool.query(`UPDATE tournament_matches SET deadline = now() - interval '1 minute' WHERE id = ANY($1)`, [[m1.id, m2.id]]);

    await sweepUntil(async () => (await matchesOf(creator, code, 1)).every((m) => m.status === 'decided'));
    const [d1, d2] = await matchesOf(creator, code, 1);
    assert.equal(d1.decided_by, 'no_show');
    assert.equal(d1.winner, d1.player_a.username === a1.username ? 'b' : 'a', 'the player who answered advances');
    assert.equal(d2.decided_by, 'no_show');
    assert.equal(d2.winner, d2.player_a.seed < d2.player_b.seed ? 'a' : 'b', 'with no one there, the better seed advances');
    assert.equal((await view(creator, code)).body.current_round, 2, 'the sweep moved the bracket on');
  });

  await t.test('deciding a match twice, at once, decides it once and makes the next round once', async () => {
    const [creator, ...rest] = (all = await players(4));
    const { code } = await begin(creator, rest);
    const [m1, m2] = await matchesOf(creator, code, 1);
    for (const m of [m1, m2]) {
      await recordRun(pool, m.id, sideOf(m, all, 'a'), { score: 900 });
      await recordRun(pool, m.id, sideOf(m, all, 'b'), { score: 100 });
    }
    const outcomes = await Promise.all([m1.id, m1.id, m2.id, m2.id, m1.id].map((id) => decideMatchIfReady(id)));
    assert.equal(outcomes.filter((o) => o.decided).length, 2, 'two matches, each decided exactly once');
    const round2 = await matchesOf(creator, code, 2);
    assert.equal(round2.length, 1, 'one final, not several');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM tournament_matches WHERE tournament_id = (SELECT id FROM tournaments WHERE code = $1)', [code]);
    assert.equal(rows[0].n, 3);
  });

  await t.test('running the sweep over again changes nothing', async () => {
    const [creator, ...rest] = (all = await players(4));
    const { code } = await begin(creator, rest);
    await pool.query(`UPDATE tournament_matches SET deadline = now() - interval '1 minute' WHERE tournament_id = (SELECT id FROM tournaments WHERE code = $1)`, [code]);
    await sweepUntil(async () => (await view(creator, code)).body.current_round === 2);
    const before = (await view(creator, code)).body;
    for (let i = 0; i < 3; i++) await sweepTournaments();
    const after = (await view(creator, code)).body;
    assert.deepEqual(after.matches.map((m) => [m.id, m.status, m.decided_by]), before.matches.map((m) => [m.id, m.status, m.decided_by]));
    assert.equal(after.matches.length, before.matches.length);
  });

  await t.test('players who have blocked each other are not asked to play: a quiet forfeit to the better seed', async () => {
    const [creator, ...rest] = (all = await players(4));
    // p1 blocks everyone else, so whoever p1 is drawn against is a blocked pair. Joined directly: the join route would
    // (rightly) have turned them away for blocking the creator.
    const code = 'b10c' + Math.random().toString(16).slice(2, 6);
    const { rows: [tour] } = await pool.query(
      `INSERT INTO tournaments (code, created_by, name, size) VALUES ($1, $2, 'Blocked Cup', 4) RETURNING id`, [code, creator.id]);
    made.codes.push(code);
    for (const p of [creator, ...rest]) await pool.query('INSERT INTO tournament_players (tournament_id, user_id) VALUES ($1, $2)', [tour.id, p.id]);
    const blocker = rest[0];
    for (const other of [creator, rest[1], rest[2]]) await pool.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)', [blocker.id, other.id]);
    try {
      assert.equal((await call(`/tournaments/${code}/start`, { method: 'POST', token: creator.token })).status, 200);
      const matches = await matchesOf(creator, code, 1);
      const theirs = matches.find((m) => [m.player_a.username, m.player_b.username].includes(blocker.username));
      assert.equal(theirs.status, 'decided');
      assert.equal(theirs.decided_by, 'forfeit');
      const other = theirs.player_a.username === blocker.username ? theirs.player_b : theirs.player_a;
      assert.equal(theirs.winner, theirs.player_a.seed < theirs.player_b.seed ? 'a' : 'b');
      assert.ok(other, 'there is an opponent');
    } finally {
      await pool.query('DELETE FROM blocks WHERE blocker_id = $1', [blocker.id]);
    }
  });

  await t.test('a deleted account forfeits its match at the next sweep, and shows as a deleted player', async () => {
    const [creator, ...rest] = (all = await players(4));
    const { code } = await begin(creator, rest);
    const victim = rest[0];
    const { deleteAccount } = await import('../src/services/accountDeletion.js');
    await deleteAccount(victim.id);
    await sweepUntil(async () => (await matchesOf(creator, code, 1)).some((m) => m.decided_by === 'forfeit'));
    const forfeited = (await matchesOf(creator, code, 1)).find((m) => m.decided_by === 'forfeit');
    const names = [forfeited.player_a.username, forfeited.player_b.username];
    assert.ok(names.includes('Deleted player'), 'the bracket keeps its shape and shows a former player');
    assert.equal((forfeited.winner === 'a' ? forfeited.player_a : forfeited.player_b).username === 'Deleted player', false);
  });

  await t.test('a finished run decides its match: two players play the real routes through to the end', async () => {
    const [creator, ...rest] = (all = await players(4));
    const { code } = await begin(creator, rest);
    const [m] = await matchesOf(creator, code, 1);
    const [a, b] = [sideOf(m, all, 'a'), sideOf(m, all, 'b')];

    const firsts = [];
    for (const player of [a, b]) {
      const started = await call(`/tournaments/matches/${m.id}/play`, { method: 'POST', token: player.token });
      assert.equal(started.status, 201, JSON.stringify(started.body));
      firsts.push(started.body.question.question_id);
      let { question, token } = started.body;
      for (let i = 0; i < 10; i++) {
        const answer = await call(`/sessions/${started.body.session_id}/answer`, {
          method: 'POST', token: player.token, body: json({ question_id: question.question_id, chosen_index: 0, token }),
        });
        assert.equal(answer.status, 200, JSON.stringify(answer.body));
        if (answer.body.session_complete) break;
        const next = await call(`/sessions/${started.body.session_id}/next`, { method: 'POST', token: player.token });
        ({ question, token } = next.body);
      }
    }
    assert.equal(firsts[0], firsts[1], 'both players were dealt the same first question');

    // The decision runs after the response has gone out, so give it a moment.
    let decided;
    for (let i = 0; i < 30 && !decided; i++) {
      await settle(100);
      decided = (await matchesOf(creator, code, 1)).find((x) => x.id === m.id && x.status === 'decided');
    }
    assert.ok(decided, 'the match was decided once both runs finished');
    assert.ok(['score', 'time', 'seed'].includes(decided.decided_by));
    const scores = await pool.query('SELECT user_id, total_score FROM game_sessions WHERE tournament_match_id = $1', [m.id]);
    const scoreOf = (p) => scores.rows.find((r) => r.user_id === p.id).total_score;
    assert.equal(decided.score_a, scoreOf(a));
    assert.equal(decided.score_b, scoreOf(b));
    if (scoreOf(a) !== scoreOf(b)) assert.equal(decided.winner, scoreOf(a) > scoreOf(b) ? 'a' : 'b');
  });
});
