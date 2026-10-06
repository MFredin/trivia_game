import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, newPlayer, skip } from './helpers/app.js';
import { OVERLAYS, activeOverlay, overlayByKey, parseHolidayPrefs } from '../src/lib/holidayOverlay.js';
import { SEASONS, inSeason } from '../src/lib/seasons.js';

const day = (iso) => new Date(`${iso}T12:00:00Z`);

test('the holiday windows', async (t) => {
  await t.test('Halloween is up from the first of October to the second of November, both days included', () => {
    assert.equal(activeOverlay(day('2026-09-30')), null);
    assert.equal(activeOverlay(day('2026-10-01')), 'halloween');
    assert.equal(activeOverlay(day('2026-10-06')), 'halloween');
    assert.equal(activeOverlay(day('2026-11-02')), 'halloween');
    assert.equal(activeOverlay(day('2026-11-03')), null);
  });

  await t.test('there is no overlay in the middle of summer', () => {
    assert.equal(activeOverlay(day('2026-07-04')), null);
  });

  await t.test('the overlay is up for the whole of its bundle\'s season, so a decorated page never loses its decoration mid-feast', () => {
    for (const season of SEASONS) {
      const overlay = OVERLAYS.find((o) => o.key === season.key);
      if (!overlay) continue;
      for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= 28; d++) {
          const date = new Date(Date.UTC(2026, m - 1, d, 12));
          if (inSeason(season, date)) assert.ok(inSeason(overlay, date), `${season.key} bundle runs on ${m}/${d} with no overlay`);
        }
      }
    }
  });

  await t.test('windows never overlap, so a day has at most one overlay', () => {
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 28; d++) {
        const date = new Date(Date.UTC(2026, m - 1, d, 12));
        assert.ok(OVERLAYS.filter((o) => inSeason(o, date)).length <= 1, `two overlays on ${m}/${d}`);
      }
    }
  });

  await t.test('only a listed overlay can be named', () => {
    assert.equal(overlayByKey('halloween'), 'halloween');
    assert.equal(overlayByKey('easter'), null);
    assert.equal(overlayByKey(undefined), null);
  });
});

test('reading a settings request', async (t) => {
  await t.test('takes either switch, or both', () => {
    assert.deepEqual(parseHolidayPrefs({ overlay: false }), { overlay: false });
    assert.deepEqual(parseHolidayPrefs({ motion: true }), { motion: true });
    assert.deepEqual(parseHolidayPrefs({ overlay: true, motion: false }), { overlay: true, motion: false });
  });

  await t.test('refuses a request that changes nothing, or sends something that is not a boolean', () => {
    assert.equal(parseHolidayPrefs({}), null);
    assert.equal(parseHolidayPrefs(null), null);
    assert.equal(parseHolidayPrefs(undefined), null);
    assert.equal(parseHolidayPrefs({ overlay: 'false' }), null, '"false" is a string, and truthy');
    assert.equal(parseHolidayPrefs({ overlay: 0 }), null);
    assert.equal(parseHolidayPrefs({ overlay: true, motion: 'no' }), null, 'one bad value refuses the whole request');
    assert.equal(parseHolidayPrefs({ colour: 'orange' }), null, 'unknown fields change nothing');
  });
});

test('holiday overlay routes', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  await boot();
  t.after(shutdown);

  const save = (as, body) => call('/account/holiday', { method: 'PATCH', token: as.token, body: json(body) });

  await t.test('which overlay is on needs no account', async () => {
    const res = await call('/holiday');
    assert.equal(res.status, 200);
    assert.ok(res.body.overlay === null || typeof res.body.overlay === 'string');
  });

  await t.test('a developer can see a holiday out of its window; an unknown name changes nothing', async () => {
    assert.equal((await call('/holiday?force=halloween')).body.overlay, 'halloween');
    assert.equal((await call('/holiday?force=easter')).body.overlay, activeOverlay());
  });

  await t.test('production ignores the force, so it can never switch a holiday on for players', async () => {
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      assert.equal((await call('/holiday?force=halloween')).body.overlay, activeOverlay());
    } finally {
      process.env.NODE_ENV = before;
    }
  });

  await t.test('a new account has both switches on', async () => {
    const a = await newPlayer();
    const { user } = (await call('/auth/me', { token: a.token })).body;
    assert.equal(user.holiday_overlay, true);
    assert.equal(user.holiday_motion, true);
  });

  await t.test('each switch changes on its own and keeps the other', async () => {
    const a = await newPlayer();
    let { user } = (await save(a, { motion: false })).body;
    assert.deepEqual([user.holiday_overlay, user.holiday_motion], [true, false]);
    ({ user } = (await save(a, { overlay: false })).body);
    assert.deepEqual([user.holiday_overlay, user.holiday_motion], [false, false]);
    ({ user } = (await save(a, { overlay: true, motion: true })).body);
    assert.deepEqual([user.holiday_overlay, user.holiday_motion], [true, true]);
  });

  await t.test('the choice is kept on the account, so it follows the player to another device', async () => {
    const a = await newPlayer();
    await save(a, { overlay: false });
    const { user } = (await call('/auth/me', { token: a.token })).body;
    assert.equal(user.holiday_overlay, false);
  });

  await t.test('one player\'s choice never reaches another', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await save(a, { overlay: false, motion: false });
    const { user } = (await call('/auth/me', { token: b.token })).body;
    assert.deepEqual([user.holiday_overlay, user.holiday_motion], [true, true]);
  });

  await t.test('a bad request is a 400 and changes nothing; no token is a 401', async () => {
    const a = await newPlayer();
    assert.equal((await save(a, { overlay: 'off' })).status, 400);
    assert.equal((await save(a, {})).status, 400);
    assert.equal((await call('/account/holiday', { method: 'PATCH', body: json({ overlay: false }) })).status, 401);
    const { user } = (await call('/auth/me', { token: a.token })).body;
    assert.deepEqual([user.holiday_overlay, user.holiday_motion], [true, true]);
  });
});
