import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, shutdown, call, json, newPlayer, skip } from './helpers/app.js';
import { OVERLAYS, OVERLAY_KEYS, activeOverlay, easterSunday, overlayActive, overlayByKey, parseHolidayPrefs } from '../src/lib/holidayOverlay.js';
import { SEASONS, inSeason } from '../src/lib/seasons.js';

const day = (iso) => new Date(`${iso}T12:00:00Z`);
const iso = (date) => date.toISOString().slice(0, 10);
const eachDay = (fromYear, toYear, fn) => {
  for (let d = new Date(Date.UTC(fromYear, 0, 1, 12)); d.getUTCFullYear() <= toYear; d = new Date(d.getTime() + 86400000)) fn(d);
};

test('Easter', async (t) => {
  await t.test('is the Western Sunday, worked out for the year', () => {
    const known = { 2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16', 2029: '2029-04-01', 2030: '2030-04-21' };
    for (const [year, expected] of Object.entries(known)) assert.equal(iso(easterSunday(Number(year))), expected, `Easter ${year}`);
  });

  await t.test('is always a Sunday between 22 March and 25 April', () => {
    for (let year = 2000; year <= 2100; year++) {
      const easter = easterSunday(year);
      assert.equal(easter.getUTCDay(), 0, `Easter ${year} is not a Sunday`);
      const monthDay = (easter.getUTCMonth() + 1) * 100 + easter.getUTCDate();
      assert.ok(monthDay >= 322 && monthDay <= 425, `Easter ${year} is on ${iso(easter)}`);
    }
  });
});

test('the holiday windows', async (t) => {
  await t.test('Halloween is up from the first of October to the second of November, both days included', () => {
    assert.equal(activeOverlay(day('2026-09-30')), null);
    assert.equal(activeOverlay(day('2026-10-01')), 'halloween');
    assert.equal(activeOverlay(day('2026-10-06')), 'halloween');
    assert.equal(activeOverlay(day('2026-11-02')), 'halloween');
  });

  await t.test('Thanksgiving follows it on the third of November and runs to the thirtieth', () => {
    assert.equal(activeOverlay(day('2026-11-03')), 'thanksgiving');
    assert.equal(activeOverlay(day('2026-11-26')), 'thanksgiving');
    assert.equal(activeOverlay(day('2026-11-30')), 'thanksgiving');
  });

  await t.test('Yule runs from the first of December to the thirtieth, and New Year\'s takes the last three days across the year', () => {
    assert.equal(activeOverlay(day('2026-12-01')), 'yule');
    assert.equal(activeOverlay(day('2026-12-25')), 'yule');
    assert.equal(activeOverlay(day('2026-12-30')), 'yule');
    assert.equal(activeOverlay(day('2026-12-31')), 'newyear');
    assert.equal(activeOverlay(day('2027-01-01')), 'newyear');
    assert.equal(activeOverlay(day('2027-01-02')), 'newyear');
    assert.equal(activeOverlay(day('2027-01-03')), null);
  });

  await t.test('Easter runs from two weeks before Easter Sunday to Easter Monday, wherever Easter falls', () => {
    // Easter 2026 is 5 April: the window is 22 March to 6 April.
    assert.equal(activeOverlay(day('2026-03-21')), null);
    assert.equal(activeOverlay(day('2026-03-22')), 'easter');
    assert.equal(activeOverlay(day('2026-04-03')), 'easter', 'Good Friday');
    assert.equal(activeOverlay(day('2026-04-05')), 'easter', 'Easter Sunday');
    assert.equal(activeOverlay(day('2026-04-06')), 'easter', 'Easter Monday');
    assert.equal(activeOverlay(day('2026-04-07')), null);
    // Easter 2027 is 28 March, three weeks earlier in the year.
    assert.equal(activeOverlay(day('2027-03-13')), null);
    assert.equal(activeOverlay(day('2027-03-14')), 'easter');
    assert.equal(activeOverlay(day('2027-03-29')), 'easter');
    assert.equal(activeOverlay(day('2027-03-30')), null);
  });

  await t.test('Midsummer is 15 to 24 June, which holds the solstice (20 or 21) and Midsummer Eve (19 to 25)', () => {
    assert.equal(activeOverlay(day('2026-06-14')), null);
    assert.equal(activeOverlay(day('2026-06-15')), 'midsummer');
    assert.equal(activeOverlay(day('2026-06-21')), 'midsummer');
    assert.equal(activeOverlay(day('2026-06-24')), 'midsummer');
    assert.equal(activeOverlay(day('2026-06-25')), null);
  });

  await t.test('there is no overlay in the middle of summer or in January after the second', () => {
    assert.equal(activeOverlay(day('2026-07-04')), null);
    assert.equal(activeOverlay(day('2026-01-20')), null);
  });

  await t.test('every day of every bundle season has an overlay, so a decorated page is never bare partway through a feast', () => {
    for (const season of SEASONS) {
      eachDay(2026, 2031, (date) => {
        if (inSeason(season, date)) assert.ok(activeOverlay(date), `the ${season.key} bundle runs on ${iso(date)} with no overlay`);
      });
    }
  });

  await t.test('windows never overlap, so a day has at most one overlay, in any of five years (Easter moves)', () => {
    eachDay(2026, 2030, (date) => {
      assert.ok(OVERLAYS.filter((overlay) => overlayActive(overlay, date)).length <= 1, `two overlays on ${iso(date)}`);
    });
  });

  await t.test('Easter can never touch another holiday, however early or late it falls', () => {
    for (let year = 2000; year <= 2100; year++) {
      const easter = easterSunday(year).getTime();
      for (const offset of [-14, 1]) {
        const date = new Date(easter + offset * 86400000 + 12 * 3600000);
        assert.equal(activeOverlay(date), 'easter', `${iso(date)} (Easter ${year})`);
      }
    }
  });

  await t.test('only a listed overlay can be named', () => {
    for (const key of OVERLAY_KEYS) assert.equal(overlayByKey(key), key);
    assert.deepEqual(OVERLAY_KEYS, ['halloween', 'thanksgiving', 'yule', 'newyear', 'easter', 'midsummer']);
    assert.equal(overlayByKey('valentines'), null);
    assert.equal(overlayByKey(undefined), null);
    assert.equal(overlayByKey({ toString: () => 'yule' }), null);
  });
});

test('reading a settings request', async (t) => {
  await t.test('takes any of the three, together or alone', () => {
    assert.deepEqual(parseHolidayPrefs({ overlay: false }), { overlay: false });
    assert.deepEqual(parseHolidayPrefs({ motion: true }), { motion: true });
    assert.deepEqual(parseHolidayPrefs({ overlay: true, motion: false }), { overlay: true, motion: false });
    assert.deepEqual(parseHolidayPrefs({ override: 'easter' }), { override: 'easter' });
    assert.deepEqual(parseHolidayPrefs({ override: null }), { override: null }, 'null is "follow the calendar", and is a change');
  });

  await t.test('refuses a request that changes nothing, or sends something that is not valid', () => {
    assert.equal(parseHolidayPrefs({}), null);
    assert.equal(parseHolidayPrefs(null), null);
    assert.equal(parseHolidayPrefs(undefined), null);
    assert.equal(parseHolidayPrefs({ overlay: 'false' }), null, '"false" is a string, and truthy');
    assert.equal(parseHolidayPrefs({ overlay: 0 }), null);
    assert.equal(parseHolidayPrefs({ overlay: true, motion: 'no' }), null, 'one bad value refuses the whole request');
    assert.equal(parseHolidayPrefs({ override: 'valentines' }), null, 'an overlay that does not exist');
    assert.equal(parseHolidayPrefs({ override: '' }), null);
    assert.equal(parseHolidayPrefs({ override: 5 }), null);
    assert.equal(parseHolidayPrefs({ colour: 'orange' }), null, 'unknown fields change nothing');
  });
});

test('holiday overlay routes', { skip: skip && 'DATABASE_URL not set' }, async (t) => {
  const { pool } = await boot();
  t.after(shutdown);

  const save = (as, body) => call('/account/holiday', { method: 'PATCH', token: as.token, body: json(body) });
  const me = async (as) => (await call('/auth/me', { token: as.token })).body.user;
  const newAdmin = async () => {
    const player = await newPlayer();
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [player.id]);
    return player;
  };

  await t.test('which overlay is on needs no account', async () => {
    const res = await call('/holiday');
    assert.equal(res.status, 200);
    assert.ok(res.body.overlay === null || OVERLAY_KEYS.includes(res.body.overlay));
  });

  await t.test('a developer can see any holiday out of its window; an unknown name changes nothing', async () => {
    for (const key of OVERLAY_KEYS) assert.equal((await call(`/holiday?force=${key}`)).body.overlay, key);
    assert.equal((await call('/holiday?force=valentines')).body.overlay, activeOverlay());
  });

  await t.test('production ignores the force, so it can never switch a holiday on for players', async () => {
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      assert.equal((await call('/holiday?force=easter')).body.overlay, activeOverlay());
    } finally {
      process.env.NODE_ENV = before;
    }
  });

  await t.test('a new account has both switches on and follows the calendar', async () => {
    const user = await me(await newPlayer());
    assert.equal(user.holiday_overlay, true);
    assert.equal(user.holiday_motion, true);
    assert.equal(user.holiday_override, null);
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
    assert.equal((await me(a)).holiday_overlay, false);
  });

  await t.test('one player\'s choice never reaches another', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await save(a, { overlay: false, motion: false });
    const user = await me(b);
    assert.deepEqual([user.holiday_overlay, user.holiday_motion], [true, true]);
  });

  await t.test('a bad request is a 400 and changes nothing; no token is a 401', async () => {
    const a = await newPlayer();
    assert.equal((await save(a, { overlay: 'off' })).status, 400);
    assert.equal((await save(a, {})).status, 400);
    assert.equal((await call('/account/holiday', { method: 'PATCH', body: json({ overlay: false }) })).status, 401);
    const user = await me(a);
    assert.deepEqual([user.holiday_overlay, user.holiday_motion], [true, true]);
  });

  await t.test('an admin can choose any overlay, and go back to the calendar', async () => {
    const admin = await newAdmin();
    for (const key of OVERLAY_KEYS) assert.equal((await save(admin, { override: key })).body.user.holiday_override, key);
    assert.equal((await me(admin)).holiday_override, 'midsummer', 'kept on the account');
    assert.equal((await save(admin, { override: null })).body.user.holiday_override, null);
  });

  await t.test('the override changes on its own: the switches are left as they were', async () => {
    const admin = await newAdmin();
    await save(admin, { overlay: false, motion: false });
    const { user } = (await save(admin, { override: 'yule' })).body;
    assert.deepEqual([user.holiday_overlay, user.holiday_motion, user.holiday_override], [false, false, 'yule']);
    const again = (await save(admin, { motion: true })).body.user;
    assert.equal(again.holiday_override, 'yule', 'changing a switch does not clear the choice');
  });

  await t.test('an overlay that does not exist is a 400 for an admin too', async () => {
    const admin = await newAdmin();
    assert.equal((await save(admin, { override: 'valentines' })).status, 400);
    assert.equal((await me(admin)).holiday_override, null);
  });

  await t.test('anyone who is not an admin is refused, plainly, and nothing is applied', async () => {
    const a = await newPlayer();
    const refused = await save(a, { override: 'easter' });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.error, 'admin_only');
    const mixed = await save(a, { overlay: false, override: 'easter' });
    assert.equal(mixed.status, 403, 'the whole request is refused, not half applied');
    const user = await me(a);
    assert.deepEqual([user.holiday_overlay, user.holiday_override], [true, null]);
  });

  await t.test('a stored choice does nothing for someone who has since lost the admin flag', async () => {
    const admin = await newAdmin();
    await save(admin, { override: 'halloween' });
    await pool.query('UPDATE users SET is_admin = false WHERE id = $1', [admin.id]);
    assert.equal((await me(admin)).holiday_override, null, 'hidden from the client');
    assert.equal((await save(admin, { override: 'yule' })).status, 403);
  });
  // A bat that flies across the page on Halloween can be caught, once, for an achievement. The same force as GET /holiday stands in for the
  // date, so these do not depend on today being near the end of October.
  const catchBat = (as, query = '?force=halloween') => call(`/holiday/bat${query}`, { method: 'POST', token: as?.token });
  const unlocked = async (as) => (await call('/achievements', { token: as.token })).body.achievements.find((a) => a.id === 'halloween_bat');

  await t.test('catching a bat needs an account', async () => {
    assert.equal((await catchBat(null)).status, 401);
  });

  await t.test('there are no bats to catch outside Halloween', async () => {
    const a = await newPlayer();
    const res = await catchBat(a, '?force=yule');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'not_in_season');
    assert.equal((await unlocked(a)).unlocked, false);
  });

  await t.test('production ignores the force here too, so a bat cannot be caught out of season', async () => {
    const a = await newPlayer();
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await catchBat(a, '?force=halloween');
      // In production only the calendar decides, so this answers for today's date, whatever it is.
      assert.equal(res.status, activeOverlay() === 'halloween' ? 200 : 404);
    } finally {
      process.env.NODE_ENV = before;
    }
  });

  await t.test('the first bat unlocks Something in the Belfry, and a second one changes nothing', async () => {
    const a = await newPlayer();
    assert.equal((await unlocked(a)).unlocked, false);
    const first = await catchBat(a);
    assert.equal(first.status, 200);
    assert.equal(first.body.unlocked, true);
    const row = await unlocked(a);
    assert.equal(row.unlocked, true);
    assert.equal(row.name, 'Something in the Belfry');
    const second = await catchBat(a);
    assert.equal(second.status, 200);
    assert.equal(second.body.unlocked, false, 'already caught');
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM user_achievements WHERE user_id = $1 AND achievement_id = 'halloween_bat'`, [a.id]);
    assert.equal(rows[0].n, 1);
  });

  await t.test('one player catching a bat unlocks nothing for another', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await catchBat(a);
    assert.equal((await unlocked(b)).unlocked, false);
  });

  await t.test('the achievement shows up in the activity feed once', async () => {
    const a = await newPlayer();
    await catchBat(a);
    await catchBat(a);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM activity_events WHERE user_id = $1 AND type = 'achievement_unlocked'`, [a.id]);
    assert.equal(rows[0].n, 1);
  });
});
