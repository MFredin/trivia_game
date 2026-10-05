import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { isReservedUsername } from '../src/lib/usernames.js';
import { displayNameSql } from '../src/lib/displayName.js';
import { boot, shutdown, call, json, newPlayer, befriend, connectSocket, skip } from './helpers/app.js';

test('names the app keeps for deleted accounts', () => {
  assert.equal(isReservedUsername('deleted-12-ab12cd34'), true);
  assert.equal(isReservedUsername('Deleted-7'), true);
  assert.equal(isReservedUsername('  Deleted Player '), true);
  assert.equal(isReservedUsername('deletedscholar'), false, 'only the app’s own pattern');
  assert.equal(isReservedUsername('Hermione'), false);
});

test('displayed names for deleted accounts', () => {
  assert.match(displayNameSql('u'), /u\.deleted_at IS NOT NULL THEN 'Deleted player' ELSE u\.username/);
});

test('account settings', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  const login = (email, password) => call('/auth/login', { method: 'POST', body: json({ email, password }) });

  await t.test('changing the password needs the current one and a long enough new one', async () => {
    const me = await newPlayer();
    const change = (body) => call('/account/password', { method: 'PATCH', token: me.token, body: json(body) });

    assert.equal((await call('/account/password', { method: 'PATCH', body: json({}) })).status, 401);
    assert.equal((await change({ current_password: 'wrong-password', new_password: 'a-new-password' })).status, 400);
    assert.equal((await change({ current_password: 'password123', new_password: 'short' })).status, 400);
    assert.equal((await login(me.email, 'password123')).status, 200, 'nothing changed yet');

    assert.equal((await change({ current_password: 'password123', new_password: 'a-new-password' })).status, 204);
    assert.equal((await login(me.email, 'a-new-password')).status, 200);
    assert.equal((await login(me.email, 'password123')).status, 401, 'the old one is gone');
  });

  await t.test('deleting an account', async (t) => {
    const leaver = await newPlayer();
    const friend = await newPlayer();
    const rival = await newPlayer();
    await befriend(leaver, friend);
    await pool.query(`UPDATE users SET avatar = 'key', theme = 'slytherin', is_admin = true WHERE id = $1`, [leaver.id]);
    await pool.query(`INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, 'first_run')`, [leaver.id]);

    // History that must outlive them: a scored run, a duel the rival won, and the activity line
    // that names the leaver as the loser.
    await pool.query(
      `INSERT INTO game_sessions (user_id, mode, question_count, time_limit_ms, status, total_score, leaderboard_window, completed_at)
       VALUES ($1, 'classic', 10, 30000, 'completed', 777, 'any', now())`,
      [leaver.id],
    );
    await pool.query(
      `INSERT INTO activity_events (user_id, type, payload) VALUES ($1, 'duel_win', $2)`,
      [rival.id, JSON.stringify({ opponent_username: leaver.username, my_score: 5, opponent_score: 3 })],
    );
    const pendingDuel = await call('/duels', { method: 'POST', token: rival.token, body: json({ opponent_username: leaver.username }) });
    assert.equal(pendingDuel.status, 201);

    await t.test('wants the right password, and does nothing without it', async () => {
      const del = (body) => call('/account', { method: 'DELETE', token: leaver.token, body: json(body) });
      assert.equal((await call('/account', { method: 'DELETE', body: json({}) })).status, 401);
      assert.equal((await del({})).status, 400);
      assert.equal((await del({ password: 'not-my-password' })).status, 400);
      assert.equal((await call('/auth/me', { token: leaver.token })).status, 200, 'still here');
    });

    await t.test('removes everything that identifies the player', async () => {
      const res = await call('/account', { method: 'DELETE', token: leaver.token, body: json({ password: 'password123' }) });
      assert.equal(res.status, 204);

      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [leaver.id]);
      const row = rows[0];
      assert.ok(row.deleted_at);
      assert.match(row.username, /^deleted-\d+-/);
      assert.equal(row.email, null);
      assert.equal(row.password_hash, null);
      assert.equal(row.invite_code, null);
      assert.equal(row.avatar, null);
      assert.equal(row.is_admin, false);
      assert.equal(row.theme, 'monochrome');

      for (const [table, column] of [['friendships', 'user_id'], ['friendships', 'friend_user_id'], ['user_achievements', 'user_id']]) {
        const left = await pool.query(`SELECT count(*) FROM ${table} WHERE ${column} = $1`, [leaver.id]);
        assert.equal(Number(left.rows[0].count), 0, `${table}.${column}`);
      }
      assert.equal((await call('/friends', { token: friend.token })).body.friends.length, 0);
    });

    await t.test('ends every way of signing in as them', async () => {
      assert.equal((await call('/auth/me', { token: leaver.token })).status, 401, 'the old token');
      assert.equal((await login(leaver.email, 'password123')).status, 401, 'the old credentials');
      await assert.rejects(connectSocket(leaver), 'the live connection');
    });

    await t.test('disappears from every list and every profile', async () => {
      assert.equal((await call(`/profile/${leaver.username}`, { token: friend.token })).status, 404);
      const found = await call(`/friends/search?q=${leaver.username}`, { token: friend.token });
      assert.deepEqual(found.body.results, []);
      assert.equal(
        (await call('/friends', { method: 'POST', token: friend.token, body: json({ username: leaver.username }) })).status,
        404,
      );
      const members = await call('/friends/members?limit=100', { token: friend.token });
      assert.ok(!members.body.results.some((m) => m.id === leaver.id));
    });

    await t.test('leaves other players’ history intact, under a neutral name', async () => {
      const board = await call('/leaderboard?mode=classic&window=all&limit=100', { token: friend.token });
      const entry = board.body.entries.find((e) => e.total_score === 777);
      assert.ok(entry, 'the run is still on the board');
      assert.equal(entry.username, 'Deleted player');

      const feed = await call('/activity?scope=self', { token: rival.token });
      const win = feed.body.events.find((e) => e.type === 'duel_win');
      assert.equal(win.payload.opponent_username, 'Deleted player', 'the name inside the rival’s own event');

      const { rows } = await pool.query('SELECT status FROM duels WHERE id = $1', [pendingDuel.body.duel_id]);
      assert.equal(rows[0].status, 'declined', 'an invite to a deleted player cannot be answered');
    });

    await t.test('frees the name and the email for someone else', async () => {
      const again = await newPlayer({ username: leaver.username });
      assert.ok(again.id !== leaver.id);
    });

    await t.test('can be asked for twice', async () => {
      const res = await call('/account', { method: 'DELETE', token: leaver.token, body: json({ password: 'password123' }) });
      assert.equal(res.status, 401, 'the token no longer authenticates, so there is nothing to delete');
    });
  });

  await t.test('names reserved for deleted accounts cannot be registered', async () => {
    for (const username of ['deleted-9-abcd1234', 'Deleted Player']) {
      const res = await call('/auth/register', {
        method: 'POST',
        body: json({ email: `${Math.random().toString(36).slice(2)}@test.invalid`, username, password: 'password123', birth_month: 1, birth_year: 1990 }),
      });
      assert.equal(res.status, 400, username);
    }
  });
});
