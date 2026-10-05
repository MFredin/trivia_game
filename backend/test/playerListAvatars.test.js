import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, newPlayer, skip } from './helpers/app.js';

// The Friends screen draws a duel invite and an activity line the same way it draws any other
// player — with their avatar — so both responses have to carry what Avatar needs.
test('lists that show a player carry their avatar', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  const challenger = await newPlayer();
  const me = await newPlayer();
  const save = (body, as) => call('/account/profile', { method: 'PATCH', token: as.token, body: json(body) });
  assert.equal((await save({ avatar: 'moon', avatar_style: { shape: 'octagon' } }, challenger)).status, 200);

  await t.test('a pending duel carries both players’ avatars', async () => {
    const made = await call('/duels', { method: 'POST', token: challenger.token, body: json({ opponent_username: me.username }) });
    assert.equal(made.status, 201);

    const incoming = (await call('/duels/pending', { token: me.token })).body.pending.find((d) => d.direction === 'incoming');
    assert.equal(incoming.created_by_username, challenger.username);
    assert.equal(incoming.created_by_avatar, 'moon');
    assert.equal(incoming.created_by_avatar_style.shape, 'octagon');
    assert.equal(incoming.opponent_avatar, null, 'a player who has not chosen one has none, and the client draws the monogram');
    assert.deepEqual(incoming.opponent_avatar_style, {});

    const outgoing = (await call('/duels/pending', { token: challenger.token })).body.pending.find((d) => d.direction === 'outgoing');
    assert.equal(outgoing.opponent_username, me.username);
    assert.equal(outgoing.created_by_avatar, 'moon');
  });

  await t.test('an activity line carries the avatar of whoever it is about', async () => {
    await pool.query(`INSERT INTO activity_events (user_id, type, payload) VALUES ($1, 'achievement_unlocked', $2)`, [
      challenger.id,
      JSON.stringify({ name: 'First Steps' }),
    ]);
    const feed = (await call('/activity?scope=self', { token: challenger.token })).body.events;
    assert.equal(feed[0].username, challenger.username);
    assert.equal(feed[0].avatar, 'moon');
    assert.equal(feed[0].avatar_style.shape, 'octagon');

    const mine = (await call('/activity?scope=self', { token: me.token })).body.events;
    assert.deepEqual(mine, [], 'and nothing is invented for a player with no activity');
  });
});
