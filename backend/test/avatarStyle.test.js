import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_OPTIONS, AVATAR_UNLOCKS, DEFAULT_AVATAR_STYLE, lockedChoices, normalizeAvatarStyle } from '../src/lib/avatarStyle.js';
import { ACHIEVEMENTS } from '../src/lib/achievements.js';
import { boot, shutdown, call, json, newPlayer, skip } from './helpers/app.js';

test('avatar style, as a pure rule', async (t) => {
  await t.test('a partial style takes the default for every layer it leaves out', () => {
    assert.deepEqual(normalizeAvatarStyle({}), DEFAULT_AVATAR_STYLE);
    assert.deepEqual(normalizeAvatarStyle({ shape: 'hexagon' }), { ...DEFAULT_AVATAR_STYLE, shape: 'hexagon' });
  });

  await t.test('anything that is not a known layer with a known id is refused whole', () => {
    for (const bad of [null, 'circle', [], { shape: 'star' }, { colour: 'gold' }, { shape: 3 }, { shape: 'circle', frame: 'x' }]) {
      assert.equal(normalizeAvatarStyle(bad), null, JSON.stringify(bad));
    }
  });

  await t.test('every unlock names a real achievement and a real option', () => {
    const achievementIds = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const [key, achievementId] of Object.entries(AVATAR_UNLOCKS)) {
      const [layer, id] = key.split(':');
      assert.ok(AVATAR_OPTIONS[layer]?.includes(id), `${key} is an option`);
      assert.ok(achievementIds.has(achievementId), `${key} needs ${achievementId}, which exists`);
    }
  });

  await t.test('colours are never earned, and every layer keeps a free choice', () => {
    assert.ok(!Object.keys(AVATAR_UNLOCKS).some((k) => k.startsWith('color:')));
    for (const layer of Object.keys(AVATAR_OPTIONS)) {
      assert.ok(AVATAR_OPTIONS[layer].some((id) => !AVATAR_UNLOCKS[`${layer}:${id}`]), layer);
    }
  });

  await t.test('lockedChoices names what has not been earned, and forgives what is already worn', () => {
    const style = { ...DEFAULT_AVATAR_STYLE, frame: 'gilt', mark: 'crown' };
    assert.deepEqual(lockedChoices(style, []).map((l) => l.key).sort(), ['frame:gilt', 'mark:crown']);
    assert.deepEqual(lockedChoices(style, ['social_duel_wins_5']).map((l) => l.key), ['mark:crown']);
    assert.deepEqual(lockedChoices(style, [], { ...DEFAULT_AVATAR_STYLE, frame: 'gilt' }).map((l) => l.key), ['mark:crown']);
  });

  await t.test('matches the layers and ids the frontend can draw', async () => {
    // An id the server accepts and the client cannot draw is a blank avatar on someone's profile.
    const frontend = await import('../../frontend/src/constants/avatarStyle.js');
    for (const layer of Object.keys(AVATAR_OPTIONS)) {
      assert.deepEqual(
        [...AVATAR_OPTIONS[layer]].sort(),
        frontend.AVATAR_STYLE_LAYERS[layer].map((o) => o.id).sort(),
        layer,
      );
    }
  });
});

test('saving an avatar style', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);
  const me = await newPlayer();
  const save = (body) => call('/account/profile', { method: 'PATCH', token: me.token, body: json(body) });
  const earn = (id) => pool.query('INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)', [me.id, id]);

  await t.test('is stored whole and comes back on the account and on the public profile', async () => {
    const res = await save({ avatar_style: { shape: 'hexagon', color: 'violet', pattern: 'rays', frame: 'ring', mark: 'star' } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.user.avatar_style, { shape: 'hexagon', color: 'violet', pattern: 'rays', frame: 'ring', mark: 'star' });

    const other = await newPlayer();
    assert.equal((await call(`/profile/${me.username}`, { token: other.token })).body.avatar_style.color, 'violet');
    assert.equal((await call(`/friends/search?q=${me.username}`, { token: other.token })).body.results[0].avatar_style.shape, 'hexagon');
  });

  await t.test('refuses a layer or an id it does not know, and changes nothing', async () => {
    for (const style of [{ shape: 'star' }, { sparkle: 'yes' }, 'circle', null]) {
      const res = await save({ avatar_style: style, avatar: 'quill' });
      assert.equal(res.status, 400, JSON.stringify(style));
    }
    assert.equal((await call('/auth/me', { token: me.token })).body.user.avatar, null, 'the valid avatar in the same request was not applied');
  });

  await t.test('keeps earned choices behind the achievement that earns them', async () => {
    const refused = await save({ avatar_style: { frame: 'gilt' } });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.error, 'option_locked');
    assert.equal(refused.body.option, 'frame:gilt');

    await earn('social_duel_wins_5');
    assert.equal((await save({ avatar_style: { frame: 'gilt' } })).status, 200);
  });

  await t.test('lists what is locked, and whether this player has it', async () => {
    const info = (await call('/account/customization', { token: me.token })).body;
    const gilt = info.locks.find((l) => l.key === 'frame:gilt');
    assert.equal(gilt.unlocked, true);
    assert.equal(gilt.achievement_name, 'Duel Champion');
    assert.equal(info.locks.find((l) => l.key === 'mark:crown').unlocked, false);
    assert.deepEqual(info.earned.map((a) => a.id), ['social_duel_wins_5']);
  });
});
