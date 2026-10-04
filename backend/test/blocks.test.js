import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, newPlayer, befriend, connectSocket, settle, skip } from './helpers/app.js';

// One boot for the whole file: the database pool is a module singleton, so a second
// boot/shutdown pair in the same process would be handed a pool the first had already closed.
test('blocking and reporting', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  await t.test('blocking', async (t) => {
    const block = (as, target) => call('/blocks', { method: 'POST', token: as.token, body: json({ username: target.username }) });
    const unblock = (as, target) => call(`/blocks/${target.username}`, { method: 'DELETE', token: as.token });
    const friendStatus = async (a, b) =>
      (await call(`/friends/search?q=${b.username}`, { token: a.token })).body.results.find((r) => r.username === b.username)?.status;

    await t.test('needs a login, refuses yourself, and does not confirm that a name exists', async () => {
      const me = await newPlayer();
      assert.equal((await call('/blocks', { method: 'POST', body: json({ username: 'x' }) })).status, 401);
      assert.equal((await block(me, me)).status, 400);
      assert.equal((await block(me, { username: 'nobody-by-this-name' })).status, 404);
      assert.equal((await call('/blocks', { method: 'POST', token: me.token, body: json({}) })).status, 400);
  });

  await t.test('ends the friendship in both directions, and any request pending between the two', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const c = await newPlayer();
    await befriend(a, b);
    await call('/friends', { method: 'POST', token: c.token, body: json({ username: a.username }) });

    assert.equal((await block(a, b)).status, 204);
    assert.equal((await call('/friends', { token: a.token })).body.friends.length, 0);
    assert.equal((await call('/friends', { token: b.token })).body.friends.length, 0);

    assert.equal((await block(a, c)).status, 204);
    assert.equal((await call('/friends/requests', { token: a.token })).body.requests.length, 0);
  });

  await t.test('is invisible to the player blocked, and works the same from either side', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await block(a, b);

    for (const [viewer, other] of [[a, b], [b, a]]) {
      assert.equal((await call(`/profile/${other.username}`, { token: viewer.token })).status, 404, 'profile');
      assert.equal((await call(`/profile/${other.username}/friends`, { token: viewer.token })).status, 404, 'friends list');
      const add = await call('/friends', { method: 'POST', token: viewer.token, body: json({ username: other.username }) });
      assert.equal(add.status, 404, 'friend request, answered like an unknown name');
      assert.equal(add.body.error, 'user_not_found');
      const duel = await call('/duels', { method: 'POST', token: viewer.token, body: json({ opponent_username: other.username }) });
      assert.equal(duel.status, 404, 'duel invite');
      assert.equal(await friendStatus(viewer, other), undefined, 'search');
    }

    const all = await call('/friends/members?limit=100', { token: b.token });
    assert.ok(!all.body.results.some((m) => m.username === a.username), 'the directory');
    // The directory's count has to leave the blocked player out as well as the list. Other test
    // files add players to this same database while this one runs, so the two totals are read
    // back to back and compared again if a player turned up between them.
    const bystander = await newPlayer();
    let agreed = false;
    for (let attempt = 0; attempt < 5 && !agreed; attempt++) {
      const mine = (await call('/friends/members?limit=1', { token: b.token })).body.total;
      const theirs = (await call('/friends/members?limit=1', { token: bystander.token })).body.total;
      // The bystander counts everyone but themself, a and b included; b counts everyone but b and a.
      agreed = mine === theirs - 1;
    }
    assert.ok(agreed, 'and its count');
  });

  await t.test('is only reported to the player who made it', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await block(a, b);
    assert.deepEqual((await call('/blocks', { token: a.token })).body.blocked.map((x) => x.username), [b.username]);
    assert.deepEqual((await call('/blocks', { token: b.token })).body.blocked, []);
  });

  await t.test('is lifted by the player who set it — and does not bring the friendship back', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await befriend(a, b);
    await block(a, b);

    assert.equal((await unblock(b, a)).status, 204, 'the blocked player lifting nothing is harmless');
    assert.equal((await call(`/profile/${a.username}`, { token: b.token })).status, 404, 'and changes nothing');

    assert.equal((await unblock(a, b)).status, 204);
    assert.equal((await call(`/profile/${b.username}`, { token: a.token })).status, 200);
    assert.equal(await friendStatus(a, b), 'none', 'strangers again, not friends');
    assert.equal((await block(a, b)).status, 204, 'and blocking twice is fine');
    assert.equal((await block(a, b)).status, 204);
  });

  await t.test('hides a blocked player from the friends list of a mutual friend', async () => {
    const viewer = await newPlayer();
    const popular = await newPlayer();
    const blocked = await newPlayer();
    const fine = await newPlayer();
    for (const f of [blocked, fine, viewer]) await befriend(popular, f);
    await pool.query(`UPDATE users SET friends_visibility = 'everyone' WHERE id = $1`, [popular.id]);
    await block(viewer, blocked);

    const list = (await call(`/profile/${popular.username}/friends`, { token: viewer.token })).body;
    const names = list.friends.map((f) => f.username);
    assert.ok(!names.includes(blocked.username));
    assert.ok(names.includes(fine.username));
    assert.equal(list.total, 2, 'the count agrees with the list (viewer + fine)');
  });

  await t.test('withdraws a duel invite waiting between the two', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const invite = await call('/duels', { method: 'POST', token: a.token, body: json({ opponent_username: b.username }) });
    assert.equal(invite.status, 201);

    await block(b, a);
    const { rows } = await pool.query('SELECT status FROM duels WHERE id = $1', [invite.body.duel_id]);
    assert.equal(rows[0].status, 'declined');
    assert.equal((await call(`/duels/${invite.body.duel_id}/accept`, { method: 'POST', token: b.token })).status, 409);
  });

  await t.test('stops duel reactions between the two, and only between the two', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const { rows } = await pool.query(
      `INSERT INTO duels (created_by, opponent_id, question_count, time_limit_ms, status)
       VALUES ($1, $2, 10, 30000, 'active') RETURNING id`,
      [a.id, b.id],
    );
    const duelId = rows[0].id;
    const sa = await connectSocket(a);
    const sb = await connectSocket(b);
    t.after(() => {
      sa.close();
      sb.close();
    });
    const react = () => sa.ws.send(json({ type: 'duel:react', duel_id: duelId, reaction: 'good_luck' }));

    react();
    await settle();
    assert.equal(sb.frames.filter((f) => f.type === 'duel:reaction').length, 1, 'relayed before the block');

    await block(b, a);
    react();
    await settle();
    assert.equal(sb.frames.filter((f) => f.type === 'duel:reaction').length, 1, 'not relayed after it');
  });
  });

  await t.test('reporting', async (t) => {
    const report = (as, target, body = {}) =>
      call('/reports', { method: 'POST', token: as.token, body: json({ username: target.username, reason: 'harassment', ...body }) });
    const admin = await newPlayer();
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [admin.id]);

    await t.test('takes a known reason and an optional note, from a signed-in player', async () => {
      const a = await newPlayer();
      const b = await newPlayer();
      assert.equal((await call('/reports', { method: 'POST', body: json({}) })).status, 401);
      assert.equal((await report(a, b)).status, 201);
      assert.equal((await report(a, b, { reason: 'because' })).status, 400);
      assert.equal((await report(a, b, { details: 'x'.repeat(501) })).status, 400);
      assert.equal((await report(a, a)).status, 400, 'not yourself');
      assert.equal((await report(a, { username: 'nobody-by-this-name' })).status, 404);
  });

  await t.test('twice while open is one row in the queue', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await report(a, b);
    assert.equal((await report(a, b, { reason: 'cheating' })).status, 201);
    const { rows } = await pool.query('SELECT reason FROM reports WHERE reporter_id = $1 AND reported_id = $2', [a.id, b.id]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].reason, 'harassment', 'the first stands');
  });

  await t.test('is read and resolved by an admin, and by nobody else', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await report(a, b, { details: 'a note' });

    assert.equal((await call('/reports', { token: a.token })).status, 403);
    assert.equal((await call('/reports')).status, 401);

    const queue = (await call('/reports', { token: admin.token })).body.reports;
    const mine = queue.find((r) => r.reported_username === b.username);
    assert.equal(mine.reporter_username, a.username);
    assert.equal(mine.reason, 'harassment');
    assert.equal(mine.details, 'a note');

    const resolve = (as, id, outcome = 'dismissed') =>
      call(`/reports/${id}/resolve`, { method: 'POST', token: as.token, body: json({ outcome }) });
    assert.equal((await resolve(a, mine.id)).status, 403);
    assert.equal((await resolve(admin, mine.id, 'banned')).status, 400);
    assert.equal((await resolve(admin, mine.id)).status, 204);
    assert.equal((await resolve(admin, mine.id)).status, 404, 'already resolved');
    assert.equal((await resolve(admin, 'abc')).status, 404);

    assert.ok(!(await call('/reports', { token: admin.token })).body.reports.some((r) => r.id === mine.id));
    assert.ok((await call('/reports?status=resolved', { token: admin.token })).body.reports.some((r) => r.id === mine.id));

    assert.equal((await report(a, b)).status, 201, 'a resolved report can be followed by a fresh one');
  });
  });
});
