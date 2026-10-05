import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, newPlayer, befriend, skip } from './helpers/app.js';
import { CONTACT_MODES, contactAllowed } from '../src/lib/contactModes.js';

test('who may be approached', async (t) => {
  await t.test('the rule: open is everyone, friends is friends, off is no one', () => {
    assert.deepEqual(CONTACT_MODES, ['open', 'friends', 'off']);
    assert.equal(contactAllowed('open', false), true);
    assert.equal(contactAllowed('friends', true), true);
    assert.equal(contactAllowed('friends', false), false);
    assert.equal(contactAllowed('off', true), false);
    assert.equal(contactAllowed(undefined, true), false, 'an unknown setting allows nothing');
  });
});

test('challenge settings', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  await boot();
  t.after(shutdown);

  const challenge = (from, to) =>
    call('/duels', { method: 'POST', token: from.token, body: json({ opponent_username: to.username }) });
  const setMode = (as, mode) => call('/duels/settings', { method: 'PATCH', token: as.token, body: json({ mode }) });

  await t.test('open by default, as it always was: anyone can be challenged', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    assert.equal((await call('/auth/me', { token: b.token })).body.user.challenges, 'open');
    assert.equal((await challenge(a, b)).status, 201);
  });

  await t.test('the setting takes the three modes and nothing else', async () => {
    const a = await newPlayer();
    for (const mode of ['friends', 'off', 'open']) assert.equal((await setMode(a, mode)).body.user.challenges, mode);
    assert.equal((await setMode(a, 'everyone')).status, 400);
    assert.equal((await call('/duels/settings', { method: 'PATCH', body: json({ mode: 'off' }) })).status, 401);
  });

  await t.test('friends only turns strangers away and lets friends in', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const friend = await newPlayer();
    await befriend(b, friend);
    await setMode(b, 'friends');

    const turned = await challenge(a, b);
    assert.equal(turned.status, 403);
    assert.equal(turned.body.error, 'not_accepting_challenges');
    assert.equal((await challenge(friend, b)).status, 201);
  });

  await t.test('off turns everyone away, and the player who is off may not challenge either', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const friend = await newPlayer();
    await befriend(b, friend);
    await setMode(b, 'off');

    assert.equal((await challenge(a, b)).body.error, 'not_accepting_challenges');
    assert.equal((await challenge(friend, b)).body.error, 'not_accepting_challenges', 'friends too');
    assert.equal((await challenge(b, a)).body.error, 'challenges_off', 'no one-way street');
  });

  await t.test('a blocked player is still the same 404, not a setting', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await call('/blocks', { method: 'POST', token: b.token, body: json({ username: a.username }) });
    assert.equal((await challenge(a, b)).status, 404);
  });

  await t.test('lists and profiles say what the viewer may start with each player', async () => {
    const me = await newPlayer();
    const open = await newPlayer();
    const closed = await newPlayer();
    const friendsOnly = await newPlayer();
    await setMode(closed, 'off');
    await call('/owlpost/settings', { method: 'PATCH', token: closed.token, body: json({ mode: 'off' }) });
    await setMode(friendsOnly, 'friends');
    await call('/owlpost/settings', { method: 'PATCH', token: friendsOnly.token, body: json({ mode: 'friends' }) });

    const profile = async (p) => (await call(`/profile/${p.username}`, { token: me.token })).body;
    assert.deepEqual([(await profile(open)).can_owl, (await profile(open)).can_challenge], [true, true]);
    assert.deepEqual([(await profile(closed)).can_owl, (await profile(closed)).can_challenge], [false, false]);
    assert.deepEqual([(await profile(friendsOnly)).can_owl, (await profile(friendsOnly)).can_challenge], [false, false]);

    await befriend(me, friendsOnly);
    assert.deepEqual([(await profile(friendsOnly)).can_owl, (await profile(friendsOnly)).can_challenge], [true, true], 'friends may');

    const search = (await call(`/friends/search?q=${encodeURIComponent(closed.username.slice(0, 8))}`, { token: me.token })).body.results;
    const row = search.find((r) => r.username === closed.username);
    assert.deepEqual([row.can_owl, row.can_challenge], [false, false]);
    assert.equal('owl_post' in row, false, 'the raw setting is not what is sent');
  });
});
