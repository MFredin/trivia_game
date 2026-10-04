import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, newPlayer, connectSocket, skip } from './helpers/app.js';

const NOTE = 'You were reported and a moderator reviewed it.';

test('moderation', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  const admin = await newPlayer();
  await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [admin.id]);

  // A fresh reported player and an open report against them, for each test that needs one.
  async function reported(reason = 'harassment') {
    const target = await newPlayer();
    const reporter = await newPlayer();
    await call('/reports', { method: 'POST', token: reporter.token, body: json({ username: target.username, reason }) });
    const entry = (await call('/reports', { token: admin.token })).body.reports.find((r) => r.reported_username === target.username);
    return { target, reporter, report: entry };
  }
  const act = (id, body, as = admin) => call(`/reports/${id}/action`, { method: 'POST', token: as.token, body: json(body) });
  const me = (as) => call('/auth/me', { token: as.token });

  await t.test('a report arrives with what a moderator needs to decide', async () => {
    const { target, report } = await reported('offensive_bio');
    assert.equal(report.history.actioned, 0);
    assert.deepEqual(report.suggestion.actions, ['clear_bio', 'warn']);
    assert.equal(report.available_actions[0], 'clear_bio');
    assert.equal(report.actionable, true);
    assert.equal(report.standing.banned, false);

    await act(report.id, { actions: ['warn'], note: NOTE });
    const { report: second } = { report: await (async () => {
      const r = await newPlayer();
      await call('/reports', { method: 'POST', token: r.token, body: json({ username: target.username, reason: 'harassment' }) });
      return (await call('/reports', { token: admin.token })).body.reports.find((x) => x.reported_username === target.username);
    })() };
    assert.equal(second.history.actioned, 1, 'the earlier action is on the record');
    assert.deepEqual(second.suggestion.actions, ['suspend'], 'so the suggestion climbs the ladder');
    assert.equal(second.suggestion.days, 1);
  });

  await t.test('only an admin may act, and only with a valid, explained set of actions', async () => {
    const { target, report } = await reported();
    assert.equal((await act(report.id, { actions: ['warn'], note: NOTE }, target)).status, 403);
    assert.equal((await call(`/reports/${report.id}/action`, { method: 'POST', body: json({}) })).status, 401);

    const bad = (body) => act(report.id, body);
    assert.equal((await bad({ actions: [], note: NOTE })).body.error, 'no_actions');
    assert.equal((await bad({ actions: ['explode'], note: NOTE })).body.error, 'invalid_action');
    assert.equal((await bad({ actions: ['ban', 'suspend'], days: 7, note: NOTE })).body.error, 'ban_and_suspend');
    assert.equal((await bad({ actions: ['suspend'], days: 3, note: NOTE })).body.error, 'invalid_days');
    assert.equal((await bad({ actions: ['warn'] })).body.error, 'invalid_note', 'the player is always told why');
    assert.equal((await bad({ actions: ['warn'], note: 'short' })).body.error, 'invalid_note');
    assert.equal((await bad({ actions: ['warn'], note: 'x'.repeat(1001) })).body.error, 'invalid_note');
    assert.equal((await act(999999, { actions: ['warn'], note: NOTE })).status, 404);
    assert.equal((await act('abc', { actions: ['warn'], note: NOTE })).status, 404);

    assert.equal((await act(report.id, { actions: ['warn'], note: NOTE })).status, 200);
    assert.equal((await act(report.id, { actions: ['warn'], note: NOTE })).status, 404, 'a closed report cannot be acted on again');
  });

  await t.test('nobody can moderate an admin or themselves', async () => {
    const other = await newPlayer();
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [other.id]);
    const reporter = await newPlayer();
    await call('/reports', { method: 'POST', token: reporter.token, body: json({ username: other.username, reason: 'other' }) });
    const entry = (await call('/reports', { token: admin.token })).body.reports.find((r) => r.reported_username === other.username);
    assert.equal(entry.actionable, false);
    const res = await act(entry.id, { actions: ['ban'], note: NOTE });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'cannot_moderate_admin');
    assert.equal((await me(other)).status, 200, 'and nothing happened to them');
  });

  await t.test('a warning stays until it is acknowledged, and only by the player it is for', async () => {
    const { target, report } = await reported();
    const res = await act(report.id, { actions: ['warn'], note: NOTE });
    assert.equal(res.body.resolution, 'Warned');

    const notices = (await call('/moderation/notices', { token: target.token })).body.notices;
    assert.equal(notices.length, 1);
    assert.equal(notices[0].note, NOTE);
    assert.deepEqual(notices[0].actions, ['warn']);

    const stranger = await newPlayer();
    assert.equal((await call(`/moderation/notices/${notices[0].batch_id}/acknowledge`, { method: 'POST', token: stranger.token })).status, 404);
    assert.equal((await call('/moderation/notices/not-a-uuid/acknowledge', { method: 'POST', token: target.token })).status, 404);

    assert.equal((await call(`/moderation/notices/${notices[0].batch_id}/acknowledge`, { method: 'POST', token: target.token })).status, 204);
    assert.deepEqual((await call('/moderation/notices', { token: target.token })).body.notices, []);
    assert.equal((await call(`/moderation/notices/${notices[0].batch_id}/acknowledge`, { method: 'POST', token: target.token })).status, 404, 'once');
  });

  await t.test('a forced rename takes the name and asks for a new one', async () => {
    const { target, report } = await reported('offensive_name');
    await act(report.id, { actions: ['force_rename', 'warn'], note: NOTE });

    const user = (await me(target)).body.user;
    assert.match(user.username, /^player-\d+-/);
    assert.equal(user.must_rename, true);

    const rename = (username, as = target) => call('/account/username', { method: 'PATCH', token: as.token, body: json({ username }) });
    const taken = await newPlayer();
    assert.equal((await rename('')).status, 400);
    assert.equal((await rename('x'.repeat(41))).status, 400);
    assert.equal((await rename('Deleted Player')).status, 400);
    assert.equal((await rename('player-5-abcd')).status, 400);
    assert.equal((await rename(taken.username)).status, 409);

    const fresh = `renamed${Math.random().toString(36).slice(2, 8)}`;
    const done = await rename(fresh);
    assert.equal(done.status, 200);
    assert.equal(done.body.user.username, fresh);
    assert.equal(done.body.user.must_rename, false);
    assert.equal((await rename('another-one')).status, 403, 'and the right to rename is spent');
  });

  await t.test('nobody else may rename themselves', async () => {
    const plain = await newPlayer();
    assert.equal((await call('/account/username', { method: 'PATCH', token: plain.token, body: json({ username: 'new-name-please' }) })).status, 403);
  });

  await t.test('resetting an avatar and clearing a bio change only that', async () => {
    const { target, report } = await reported();
    await call('/account/profile', {
      method: 'PATCH',
      token: target.token,
      body: json({ avatar: 'key', avatar_style: { shape: 'hexagon' }, bio: 'hello there' }),
    });
    await act(report.id, { actions: ['reset_avatar'], note: NOTE });
    const user = (await me(target)).body.user;
    assert.equal(user.avatar, null);
    assert.deepEqual(user.avatar_style, {});
    assert.equal(user.bio, 'hello there');
  });

  await t.test('removing scores takes a player off the leaderboards, and nothing is deleted', async () => {
    const { target, report } = await reported('cheating');
    await pool.query(
      `INSERT INTO game_sessions (user_id, mode, question_count, time_limit_ms, status, total_score, leaderboard_window, completed_at)
       VALUES ($1, 'classic', 10, 30000, 'completed', 98765, 'any', now())`,
      [target.id],
    );
    const board = async () => (await call('/leaderboard?mode=classic&window=all&limit=100', { token: admin.token })).body.entries;
    assert.ok((await board()).some((e) => e.total_score === 98765), 'on the board before');

    await act(report.id, { actions: ['remove_scores', 'warn'], note: NOTE });
    assert.ok(!(await board()).some((e) => e.total_score === 98765), 'off it after, with no wait for the cache');
    const { rows } = await pool.query('SELECT count(*) FROM game_sessions WHERE user_id = $1', [target.id]);
    assert.equal(Number(rows[0].count), 1, 'the run is still there');
  });

  await t.test('a suspension locks every way in, with the reason, until it ends or is lifted', async () => {
    const { target, report } = await reported();
    const socket = await connectSocket(target);
    const closed = new Promise((resolve) => socket.ws.once('close', resolve));

    const res = await act(report.id, { actions: ['suspend'], days: 7, note: 'Seven days, for harassment.' });
    assert.equal(res.body.resolution, 'Suspended 7 days');
    await closed;

    const blocked = await me(target);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error, 'account_suspended');
    assert.ok(Date.parse(blocked.body.until));
    assert.equal(blocked.body.note, 'Seven days, for harassment.');

    const login = await call('/auth/login', { method: 'POST', body: json({ email: target.email, password: 'password123' }) });
    assert.equal(login.status, 403);
    assert.equal(login.body.error, 'account_suspended');
    assert.equal(login.body.note, 'Seven days, for harassment.');
    const wrongPassword = await call('/auth/login', { method: 'POST', body: json({ email: target.email, password: 'wrong-password' }) });
    assert.equal(wrongPassword.status, 401, 'the reason is for the account holder, not for anyone who guesses an email');

    await assert.rejects(connectSocket(target), 'no new connection either');

    const log = (await call('/moderation/actions', { token: admin.token })).body.actions;
    const entry = log.find((a) => a.action === 'suspend' && a.username === target.username);
    assert.equal(entry.active, true);
    assert.equal(entry.days, 7);

    assert.equal((await call(`/moderation/actions/${entry.id}/lift`, { method: 'POST', token: target.token })).status, 403);
    assert.equal((await call(`/moderation/actions/${entry.id}/lift`, { method: 'POST', token: admin.token })).status, 204);
    assert.equal((await me(target)).status, 200, 'back in at once');
    assert.equal((await call(`/moderation/actions/${entry.id}/lift`, { method: 'POST', token: admin.token })).status, 404, 'once');
    assert.equal((await call('/moderation/actions', { token: admin.token })).body.actions.find((a) => a.id === entry.id).active, false);
  });

  await t.test('a suspension that has run out is no suspension', async () => {
    const { target, report } = await reported();
    await act(report.id, { actions: ['suspend'], days: 1, note: NOTE });
    assert.equal((await me(target)).status, 403);
    await pool.query(`UPDATE users SET suspended_until = now() - interval '1 minute' WHERE id = $1`, [target.id]);
    assert.equal((await me(target)).status, 200);
  });

  await t.test('lifting one of two overlapping suspensions leaves the other', async () => {
    const target = await newPlayer();
    const make = async () => {
      const reporter = await newPlayer();
      await call('/reports', { method: 'POST', token: reporter.token, body: json({ username: target.username, reason: 'harassment' }) });
      const entry = (await call('/reports', { token: admin.token })).body.reports.find((r) => r.reported_username === target.username);
      await act(entry.id, { actions: ['suspend'], days: entry.id % 2 === 0 ? 1 : 7, note: NOTE });
    };
    await make();
    await make();
    const mine = (await call('/moderation/actions', { token: admin.token })).body.actions.filter((a) => a.username === target.username && a.action === 'suspend');
    assert.equal(mine.length, 2);
    await call(`/moderation/actions/${mine[0].id}/lift`, { method: 'POST', token: admin.token });
    assert.equal((await me(target)).status, 403, 'the other still holds');
    await call(`/moderation/actions/${mine[1].id}/lift`, { method: 'POST', token: admin.token });
    assert.equal((await me(target)).status, 200);
  });

  await t.test('a ban locks the account out for good, and its email cannot be used again even after deletion', async () => {
    const { target, report } = await reported();
    await act(report.id, { actions: ['ban'], note: 'Banned for repeated harassment.' });

    const blocked = await me(target);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error, 'account_banned');
    assert.equal(blocked.body.note, 'Banned for repeated harassment.');
    const login = await call('/auth/login', { method: 'POST', body: json({ email: target.email, password: 'password123' }) });
    assert.equal(login.body.error, 'account_banned');

    // Deleting the account would normally free the email; for a banned one it must not.
    await pool.query('UPDATE users SET email = NULL, deleted_at = now() WHERE id = $1', [target.id]);
    const register = (email) =>
      call('/auth/register', {
        method: 'POST',
        body: json({ email, username: `again${Math.random().toString(36).slice(2, 8)}`, password: 'password123' }),
      });
    const refused = await register(target.email);
    assert.equal(refused.status, 409, 'refused as an ordinary collision, giving nothing away');
    assert.equal(refused.body.error, 'email_or_username_taken');
    assert.equal((await register(target.email.toUpperCase())).status, 409, 'however it is capitalised');

    const entry = (await call('/moderation/actions', { token: admin.token })).body.actions.find((a) => a.action === 'ban' && a.active);
    // The log shows a deleted account as "Deleted player"; find ours by id instead.
    const { rows } = await pool.query(`SELECT id FROM moderation_actions WHERE user_id = $1 AND action = 'ban'`, [target.id]);
    assert.ok(entry);
    assert.equal((await call(`/moderation/actions/${rows[0].id}/lift`, { method: 'POST', token: admin.token })).status, 204);
    assert.equal((await register(target.email)).status, 201, 'lifting the ban frees the address');
  });

  await t.test('an action against a deleted player is refused, and the screen says it cannot be done', async () => {
    const { target, report } = await reported();
    await pool.query('UPDATE users SET deleted_at = now(), email = NULL WHERE id = $1', [target.id]);
    const listed = (await call('/reports', { token: admin.token })).body.reports.find((r) => r.id === report.id);
    assert.equal(listed.actionable, false);
    assert.equal(listed.reported_username, 'Deleted player');
    assert.equal((await act(report.id, { actions: ['warn'], note: NOTE })).status, 404);
  });

  await t.test('a closed report says what it ended in', async () => {
    const { report } = await reported();
    await act(report.id, { actions: ['clear_bio', 'warn'], note: NOTE });
    const resolved = (await call('/reports?status=resolved', { token: admin.token })).body.reports.find((r) => r.id === report.id);
    assert.equal(resolved.status, 'actioned');
    assert.equal(resolved.resolution, 'Bio cleared; warned');
  });
});
