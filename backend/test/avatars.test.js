import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_SIGILS, isValidAvatar } from '../src/lib/avatars.js';
import { boot, shutdown, call, json, newPlayer, skip } from './helpers/app.js';

test('the sigil allow-list', async (t) => {
  await t.test('has no duplicates', () => {
    assert.equal(new Set(AVATAR_SIGILS).size, AVATAR_SIGILS.length);
  });

  await t.test('accepts null (the initial) and any listed sigil, and nothing else', () => {
    assert.equal(isValidAvatar(null), true);
    assert.equal(isValidAvatar('quill'), true);
    assert.equal(isValidAvatar('lightning-bolt'), false);
    assert.equal(isValidAvatar(''), false);
    assert.equal(isValidAvatar(undefined), false);
    assert.equal(isValidAvatar(7), false);
  });

  await t.test('matches the sigils the frontend can draw', async () => {
    // A sigil the server stores but the client cannot draw is a blank disc on someone's profile.
    const frontend = await import('../../frontend/src/constants/avatarSigils.js');
    assert.deepEqual(
      [...AVATAR_SIGILS].sort(),
      frontend.AVATAR_SIGILS.map((s) => s.id).sort(),
    );
  });
});

test('avatar routes', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  await boot();
  t.after(shutdown);
  const me = await newPlayer();
  const other = await newPlayer();
  const save = (body, as = me) => call('/account/profile', { method: 'PATCH', token: as.token, body: json(body) });

  await t.test('need a login', async () => {
    assert.equal((await call('/account/profile', { method: 'PATCH', body: json({ avatar: 'key' }) })).status, 401);
  });

  await t.test('pick a sigil, and clear it again', async () => {
    const set = await save({ avatar: 'key' });
    assert.equal(set.status, 200);
    assert.equal(set.body.user.avatar, 'key');
    assert.equal((await call('/auth/me', { token: me.token })).body.user.avatar, 'key', 'it persists');

    assert.equal((await save({ avatar: null })).body.user.avatar, null);
  });

  await t.test('refuse anything that is not a known sigil', async () => {
    for (const avatar of ['nope', 12, {}, true]) {
      const res = await save({ avatar });
      assert.equal(res.status, 400, `rejects ${JSON.stringify(avatar)}`);
    }
  });

  await t.test('shows on other players’ member lists, with the house to draw it in', async () => {
    await save({ avatar: 'star' });
    const found = await call(`/friends/search?q=${me.username}`, { token: other.token });
    assert.equal(found.body.results[0].avatar, 'star');
    assert.equal(found.body.results[0].theme, 'monochrome');
  });
});
