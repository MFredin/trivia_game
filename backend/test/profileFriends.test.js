import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { canSeeFriends, isValidFriendsVisibility } from '../src/lib/friendsVisibility.js';
import { deriveStatus } from '../src/lib/friendStatus.js';
import { boot, shutdown, call, json, newPlayer, befriend, skip } from './helpers/app.js';

test('who may see a friends list', async (t) => {
  const see = (visibility, isSelf, isFriend) => canSeeFriends({ visibility, isSelf, isFriend });

  await t.test('an owner always sees their own', () => {
    for (const v of ['everyone', 'friends', 'only_me']) assert.equal(see(v, true, false), true);
  });
  await t.test('"everyone" is open to any signed-in player', () => {
    assert.equal(see('everyone', false, false), true);
  });
  await t.test('"friends" is open to friends and nobody else', () => {
    assert.equal(see('friends', false, true), true);
    assert.equal(see('friends', false, false), false);
  });
  await t.test('"only_me" is closed even to friends', () => {
    assert.equal(see('only_me', false, true), false);
  });
  await t.test('anything unrecognised is treated as closed', () => {
    assert.equal(see('whoever', false, true), false);
    assert.equal(isValidFriendsVisibility('whoever'), false);
  });
});

test('relationship words', () => {
  assert.equal(deriveStatus({ outgoing_status: 'accepted' }), 'friends');
  assert.equal(deriveStatus({ incoming_status: 'accepted' }), 'friends');
  assert.equal(deriveStatus({ outgoing_status: 'pending' }), 'pending_sent');
  assert.equal(deriveStatus({ incoming_status: 'pending' }), 'pending_received');
  assert.equal(deriveStatus({}), 'none');
});

test('profile and its friends list', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  await boot();
  t.after(shutdown);

  const owner = await newPlayer();
  const friend = await newPlayer();
  const second = await newPlayer();
  const stranger = await newPlayer();
  await befriend(owner, friend);
  await befriend(owner, second);

  const profile = (as, name = owner.username) => call(`/profile/${name}`, { token: as.token });
  const friends = (as, query = '') => call(`/profile/${owner.username}/friends${query}`, { token: as });

  await t.test('carry the owner’s avatar, join date and how the viewer stands to them', async () => {
    await call('/account/avatar', { method: 'PATCH', token: owner.token, body: json({ avatar: 'lantern' }) });

    const asSelf = (await profile(owner)).body;
    assert.equal(asSelf.avatar, 'lantern');
    assert.equal(asSelf.relationship, 'self');
    assert.ok(Date.parse(asSelf.member_since), 'a join date');
    assert.equal(typeof asSelf.online, 'boolean');

    assert.equal((await profile(friend)).body.relationship, 'friends');
    assert.equal((await profile(stranger)).body.relationship, 'none');

    await call('/friends', { method: 'POST', token: stranger.token, body: json({ username: owner.username }) });
    assert.equal((await profile(stranger)).body.relationship, 'pending_sent');
    assert.equal((await profile(owner, stranger.username)).body.relationship, 'pending_received');
  });

  await t.test('friends are listed to friends and to the owner by default, but not to strangers', async () => {
    assert.equal((await profile(owner)).body.friends.count, 2);
    assert.equal((await profile(friend)).body.friends.visible, true);

    const asStranger = (await profile(stranger)).body;
    assert.deepEqual(asStranger.friends, { visible: false, count: null }, 'not even the number leaks');

    const list = await friends(stranger.token);
    assert.equal(list.status, 200, 'a private list is a 200, not a missing page');
    assert.equal(list.body.visible, false);
    assert.deepEqual(list.body.friends, []);

    const mine = await friends(friend.token);
    assert.deepEqual(
      mine.body.friends.map((f) => f.username).sort(),
      [friend.username, second.username].sort(),
    );
  });

  await t.test('the setting changes who sees it', async () => {
    const set = (value) =>
      call('/account/privacy', { method: 'PATCH', token: owner.token, body: json({ friends_visibility: value }) });

    assert.equal((await set('everyone')).body.user.friends_visibility, 'everyone');
    assert.equal((await friends(stranger.token)).body.visible, true);

    assert.equal((await set('only_me')).status, 200);
    assert.equal((await friends(friend.token)).body.visible, false, 'friends are shut out too');
    assert.equal((await friends(owner.token)).body.visible, true, 'the owner never is');

    assert.equal((await set('friends')).status, 200);
  });

  await t.test('the setting refuses values it does not know', async () => {
    for (const value of ['public', '', null, 3]) {
      const res = await call('/account/privacy', {
        method: 'PATCH',
        token: owner.token,
        body: json({ friends_visibility: value }),
      });
      assert.equal(res.status, 400, `rejects ${JSON.stringify(value)}`);
    }
  });

  await t.test('the list pages', async () => {
    const page = await friends(owner.token, '?limit=1');
    assert.equal(page.body.friends.length, 1);
    assert.equal(page.body.total, 2);
    assert.equal(page.body.has_more, true);
    const rest = await friends(owner.token, '?limit=1&offset=1');
    assert.equal(rest.body.has_more, false);
  });

  await t.test('need a login, and an unknown player is a 404', async () => {
    assert.equal((await call(`/profile/${owner.username}/friends`)).status, 401);
    assert.equal((await call('/profile/nobody-by-this-name/friends', { token: owner.token })).status, 404);
  });
});
