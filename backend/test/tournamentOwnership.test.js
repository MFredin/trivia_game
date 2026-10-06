import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, skip } from './helpers/app.js';
import { cleanup, makePlayers, matchesOf, recordRun, startedTournament, view } from './helpers/tournaments.js';

// "Every route that names a resource by id proves ownership, and returns 404 rather than 403 when it is not yours"
// (CLAUDE.md). A tournament is found by its code, and only by the people in it: everyone else gets the answer they would get
// for a code nobody has, so a code is not a way to find out whether a tournament exists. This also covers who may join, and
// the rules around starting a match.
const made = { players: [], codes: [] };

test('tournament routes: ownership and rules', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(async () => {
    await pool.query('DELETE FROM blocks WHERE blocker_id = ANY($1)', [made.players.map((p) => p.id)]);
    await cleanup(pool, made.players, made.codes);
    await shutdown();
  });
  const players = async (n) => {
    const ps = await makePlayers(n);
    made.players.push(...ps);
    return ps;
  };
  const create = async (creator, settings = {}) => {
    const res = await call('/tournaments', { method: 'POST', token: creator.token, body: json({ name: 'Cup', size: 4, ...settings }) });
    if (res.body?.code) made.codes.push(res.body.code);
    return res;
  };
  const as = (player, path, method = 'GET', body) => call(`/tournaments${path}`, { method, token: player.token, ...(body ? { body: json(body) } : {}) });

  const [creator, member, stranger, outsider] = await players(4);
  const created = await create(creator);
  const { code } = created.body;
  await as(member, '/join', 'POST', { code });

  await t.test('creating returns a code, and the creator is the first player', async () => {
    assert.equal(created.status, 201);
    assert.match(code, /^[0-9a-f]{8}$/);
    const v = (await view(creator, code)).body;
    assert.equal(v.status, 'open');
    assert.equal(v.is_creator, true);
    assert.deepEqual(v.players.map((p) => p.username).sort(), [creator.username, member.username].sort());
  });

  await t.test('a stranger gets the same answer for a real tournament as for one that does not exist', async () => {
    const missing = 'deadbeef';
    for (const [path, method] of [['', 'GET'], ['/start', 'POST'], ['/leave', 'POST'], ['/cancel', 'POST']]) {
      const real = await as(stranger, `/${code}${path}`, method);
      const none = await as(stranger, `/${missing}${path}`, method);
      assert.equal(real.status, 404, `${method} ${path}`);
      assert.deepEqual(real.body, none.body, `${method} ${path} is distinguishable from a code that is not there`);
    }
    const removal = await as(stranger, `/${code}/players/${member.username}`, 'DELETE');
    assert.equal(removal.status, 404);
  });

  await t.test('a code that cannot be one is a 404, not an error', async () => {
    for (const bad of ['nope', '123', 'ZZZZZZZZ', '../etc']) assert.equal((await as(stranger, `/${bad}`)).status, 404, bad);
    assert.equal((await as(stranger, '/join', 'POST', { code: 'nonsense' })).status, 404);
    assert.equal((await as(stranger, '/join', 'POST', {})).status, 404);
  });

  await t.test('everything needs a login', async () => {
    assert.equal((await call(`/tournaments/${code}`)).status, 401);
    assert.equal((await call('/tournaments/mine')).status, 401);
    assert.equal((await call('/tournaments', { method: 'POST', body: json({ name: 'x' }) })).status, 401);
  });

  await t.test('only the creator may start, remove a player, or cancel; a member who tries is told so', async () => {
    assert.equal((await as(member, `/${code}/start`, 'POST')).status, 403);
    assert.equal((await as(member, `/${code}/players/${creator.username}`, 'DELETE')).status, 403);
    assert.equal((await as(member, `/${code}/cancel`, 'POST')).status, 403);
  });

  await t.test('joining: not twice, not when full, not by a code that is not there, not once it has started', async () => {
    assert.equal((await as(member, '/join', 'POST', { code })).body.error, 'already_joined');
    assert.equal((await as(stranger, '/join', 'POST', { code: 'deadbeef' })).status, 404);

    const full = await create(creator, { size: 4 });
    const [p2, p3, p4] = await players(3);
    for (const p of [p2, p3, p4]) assert.equal((await as(p, '/join', 'POST', { code: full.body.code })).status, 200);
    const late = await as(outsider, '/join', 'POST', { code: full.body.code });
    assert.equal(late.status, 409);
    assert.equal(late.body.error, 'full');

    await as(creator, `/${full.body.code}/start`, 'POST');
    assert.equal((await as(outsider, '/join', 'POST', { code: full.body.code })).body.error, 'not_open');
  });

  await t.test('it cannot start with fewer than three players', async () => {
    const small = await create(creator);
    const res = await as(creator, `/${small.body.code}/start`, 'POST');
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'too_few_players');
  });

  await t.test('a player who has blocked the creator, or been blocked by them, cannot find the tournament at all', async () => {
    const [host, blocker, blocked] = await players(3);
    const mine = await create(host);
    await pool.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2), ($3, $4)', [blocker.id, host.id, host.id, blocked.id]);
    for (const p of [blocker, blocked]) {
      const res = await as(p, '/join', 'POST', { code: mine.body.code });
      assert.equal(res.status, 404, 'the answer must not reveal that a block is why');
      assert.equal(res.body.error, 'not_found');
    }
  });

  await t.test('Challenges set to Off keeps a player out, both ways', async () => {
    const [host, off] = await players(2);
    await pool.query(`UPDATE users SET challenges = 'off' WHERE id = $1`, [off.id]);
    const mine = await create(host);
    assert.equal((await as(off, '/join', 'POST', { code: mine.body.code })).status, 403);
    const theirs = await create(off);
    assert.equal(theirs.status, 403, 'someone who accepts no challenges may not run one');
    assert.equal(theirs.body.error, 'challenges_off');

    await pool.query(`UPDATE users SET challenges = 'friends' WHERE id = $1`, [off.id]);
    assert.equal((await as(off, '/join', 'POST', { code: mine.body.code })).status, 403, 'friends only, and they are not friends');
    await pool.query(
      `INSERT INTO friendships (user_id, friend_user_id, status, requested_by) VALUES ($1, $2, 'accepted', $1), ($2, $1, 'accepted', $1)`,
      [host.id, off.id],
    );
    assert.equal((await as(off, '/join', 'POST', { code: mine.body.code })).status, 200, 'as friends they may');
  });

  await t.test('the name must be a name, and the settings must come from the menus', async () => {
    assert.equal((await create(creator, { name: '' })).status, 400);
    assert.equal((await create(creator, { name: 'visit example.com' })).status, 400);
    assert.equal((await create(creator, { name: 'x'.repeat(41) })).body.error, 'name_too_long');
    assert.equal((await create(creator, { size: 5 })).body.error, 'invalid_size');
    assert.equal((await create(creator, { round_hours: 12 })).body.error, 'invalid_round_hours');
    assert.equal((await create(creator, { difficulty: 'Expert' })).body.error, 'invalid_difficulty');
  });

  await t.test('a member may leave while it is open; the creator may not; nobody leaves once it has started', async () => {
    const [host, a, b, c] = await players(4);
    const mine = await create(host);
    for (const p of [a, b, c]) await as(p, '/join', 'POST', { code: mine.body.code });
    assert.equal((await as(a, `/${mine.body.code}/leave`, 'POST')).status, 200);
    assert.equal((await as(a, `/${mine.body.code}`)).status, 404, 'having left, they can no longer see it');
    assert.equal((await as(host, `/${mine.body.code}/leave`, 'POST')).body.error, 'creator_cannot_leave');
    assert.equal((await as(host, `/${mine.body.code}/players/${b.username}`, 'DELETE')).status, 200);
    assert.equal((await as(host, `/${mine.body.code}/players/${b.username}`, 'DELETE')).body.error, 'player_not_found');
    await as(a, '/join', 'POST', { code: mine.body.code });
    await as(host, `/${mine.body.code}/start`, 'POST');
    assert.equal((await as(c, `/${mine.body.code}/leave`, 'POST')).body.error, 'already_started');
  });

  await t.test('cancelling ends it; a cancelled tournament cannot be started or joined', async () => {
    const [host, a, b, late] = await players(4);
    const mine = await create(host);
    for (const p of [a, b]) await as(p, '/join', 'POST', { code: mine.body.code });
    assert.equal((await as(host, `/${mine.body.code}/cancel`, 'POST')).status, 200);
    assert.equal((await view(host, mine.body.code)).body.status, 'cancelled');
    assert.equal((await as(host, `/${mine.body.code}/start`, 'POST')).body.error, 'not_open');
    assert.equal((await as(late, '/join', 'POST', { code: mine.body.code })).body.error, 'not_open');
    assert.equal((await as(host, `/${mine.body.code}/cancel`, 'POST')).body.error, 'already_over');
  });

  await t.test('a moderator may cancel any tournament, and a player may not cancel someone else\'s', async () => {
    const [host, a, b, mod] = await players(4);
    await pool.query('UPDATE users SET is_moderator = true WHERE id = $1', [mod.id]);
    const mine = await create(host);
    for (const p of [a, b]) await as(p, '/join', 'POST', { code: mine.body.code });
    assert.equal((await as(a, `/${mine.body.code}/cancel`, 'POST')).status, 403);
    assert.equal((await as(mod, `/${mine.body.code}/cancel`, 'POST')).status, 200);
    assert.equal((await view(host, mine.body.code)).body.status, 'cancelled');
  });

  await t.test('my tournaments lists mine, and only mine', async () => {
    const mine = (await as(creator, '/mine')).body.tournaments;
    assert.ok(mine.some((x) => x.code === code));
    assert.equal((await as(outsider, '/mine')).body.tournaments.some((x) => x.code === code), false);
  });

  await t.test('starting a match: only its players, once, while it is open', async () => {
    const [host, ...rest] = await players(4);
    const { code: running } = await startedTournament(host, rest);
    made.codes.push(running);
    const [m] = await matchesOf(host, running, 1);
    const mePlayer = [host, ...rest].find((p) => p.username === m.player_a.username);
    const other = [host, ...rest].find((p) => p.username === m.player_b.username);
    const notIn = [host, ...rest].find((p) => ![m.player_a.username, m.player_b.username].includes(p.username));

    const miss = await as(notIn, `/matches/${m.id}/play`, 'POST');
    const gone = await as(notIn, '/matches/999999999/play', 'POST');
    assert.equal(miss.status, 404, 'someone who is not in the match');
    assert.deepEqual(miss.body, gone.body, 'indistinguishable from a match that is not there');
    assert.equal((await as(mePlayer, '/matches/abc/play', 'POST')).status, 404);

    const first = await as(mePlayer, `/matches/${m.id}/play`, 'POST');
    assert.equal(first.status, 201);
    assert.equal(first.body.mode, 'tournament');
    assert.equal(first.body.question_count, 10);
    assert.ok(first.body.question && first.body.token);
    assert.equal(first.body.question.correct_answer, undefined, 'nothing that reveals the answer crosses to the client');
    const again = await as(mePlayer, `/matches/${m.id}/play`, 'POST');
    assert.equal(again.status, 409);
    assert.equal(again.body.error, 'already_started');

    const theirs = await as(other, `/matches/${m.id}/play`, 'POST');
    assert.equal(theirs.body.question.question_id, first.body.question.question_id, 'both are dealt the same first question');

    // After the deadline the match is closed to new runs.
    const [m2] = (await matchesOf(host, running, 1)).filter((x) => x.id !== m.id);
    await pool.query(`UPDATE tournament_matches SET deadline = now() - interval '1 minute' WHERE id = $1`, [m2.id]);
    const p2 = [host, ...rest].find((p) => p.username === m2.player_a.username);
    assert.equal((await as(p2, `/matches/${m2.id}/play`, 'POST')).body.error, 'match_closed');
  });

  await t.test('scores are hidden until a match is decided, and shown after', async () => {
    const [host, ...rest] = await players(4);
    const all = [host, ...rest];
    const { code: c } = await startedTournament(host, rest);
    made.codes.push(c);
    const [m] = await matchesOf(host, c, 1);
    const [a, b] = [all.find((p) => p.username === m.player_a.username), all.find((p) => p.username === m.player_b.username)];
    await recordRun(pool, m.id, a, { score: 700 });
    const during = (await matchesOf(host, c, 1)).find((x) => x.id === m.id);
    assert.equal(during.score_a, null);
    assert.equal(during.score_b, null);
    // Side A's run is recorded and side B's is not, so a viewer's own state depends on which side they are on.
    const expected = host.username === m.player_a.username ? 'finished' : host.username === m.player_b.username ? 'to_play' : null;
    assert.equal(during.my_state, expected);
    await recordRun(pool, m.id, b, { score: 200, flagged: true });
    const { decideMatchIfReady } = await import('../src/services/tournamentMatches.js');
    await decideMatchIfReady(m.id);
    const after = (await matchesOf(host, c, 1)).find((x) => x.id === m.id);
    assert.equal(after.score_a, 700);
    assert.equal(after.score_b, 200);
    assert.equal(after.under_review, true, 'a flagged run is reported, not silently counted');
  });

  await t.test('a tournament match is on no public leaderboard, and does not count toward the House Cup', async () => {
    const [p] = await players(1);
    const { invalidateLeaderboardCache } = await import('../src/lib/leaderboardCache.js');
    const [host, ...rest] = await players(4);
    const { code: c } = await startedTournament(host, rest);
    made.codes.push(c);
    const [m] = await matchesOf(host, c, 1);
    await pool.query(`UPDATE users SET theme = 'ravenclaw' WHERE id = $1`, [p.id]);
    invalidateLeaderboardCache();
    const before = (await call('/leaderboard/house-cup')).body;
    await recordRun(pool, m.id, p, { score: 99999 });
    invalidateLeaderboardCache();
    const after = (await call('/leaderboard/house-cup')).body;
    assert.deepEqual(after.houses, before.houses, 'a tournament score moved the House Cup');

    const board = await call('/leaderboard?mode=tournament&window=all');
    assert.equal(board.body.mode, 'classic', 'asking for the tournament board gets Classic, not the scores');
    assert.equal(board.body.entries.some((e) => e.total_score === 99999), false);
  });

  await t.test('deleting an account takes the player out of an open tournament, and cancels one they were hosting', async () => {
    const [host, guest] = await players(2);
    const mine = await create(host);
    await as(guest, '/join', 'POST', { code: mine.body.code });
    const { deleteAccount } = await import('../src/services/accountDeletion.js');
    await deleteAccount(guest.id);
    assert.equal((await view(host, mine.body.code)).body.players.length, 1, 'the leaver is gone from the lobby');
    await deleteAccount(host.id);
    const { rows } = await pool.query('SELECT status FROM tournaments WHERE code = $1', [mine.body.code]);
    assert.equal(rows[0].status, 'cancelled', 'a hosted lobby is cancelled with its host');
  });

  await t.test('a lobby nobody started is swept away after a week', async () => {
    const [host] = await players(1);
    const stale = await create(host);
    await pool.query(`UPDATE tournaments SET created_at = now() - interval '8 days' WHERE code = $1`, [stale.body.code]);
    const { sweepTournaments } = await import('../src/services/tournamentMatches.js');
    let status;
    for (let i = 0; i < 25 && status !== 'cancelled'; i++) {
      await sweepTournaments();
      status = (await pool.query('SELECT status FROM tournaments WHERE code = $1', [stale.body.code])).rows[0].status;
      if (status !== 'cancelled') await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(status, 'cancelled');
  });
});
