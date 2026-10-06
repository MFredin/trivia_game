import test from 'node:test';
import assert from 'node:assert/strict';
import { SEASONS, MIN_SEASON_POOL, activeSeason, inSeason, seasonKey, seasonYear, seasonFromKey } from '../src/lib/seasons.js';
import { seasonPool, seasonalChallengeSpec } from '../src/lib/seasonalChallenge.js';

const day = (iso) => new Date(`${iso}T12:00:00Z`);
const halloween = SEASONS.find((s) => s.key === 'halloween');
const yule = SEASONS.find((s) => s.key === 'yule');

test('a window includes both of its end days and nothing outside them', () => {
  assert.equal(inSeason(halloween, day('2026-10-16')), false);
  assert.equal(inSeason(halloween, day('2026-10-17')), true);
  assert.equal(inSeason(halloween, day('2026-10-31')), true);
  assert.equal(inSeason(halloween, day('2026-11-02')), true);
  assert.equal(inSeason(halloween, day('2026-11-03')), false);
});

test('a window that crosses New Year is active on both sides of it', () => {
  assert.equal(inSeason(yule, day('2026-12-17')), false);
  assert.equal(inSeason(yule, day('2026-12-18')), true);
  assert.equal(inSeason(yule, day('2026-12-31')), true);
  assert.equal(inSeason(yule, day('2027-01-01')), true);
  assert.equal(inSeason(yule, day('2027-01-02')), true);
  assert.equal(inSeason(yule, day('2027-01-03')), false);
});

test('activeSeason is null between seasons and finds the right one inside', () => {
  assert.equal(activeSeason(day('2026-07-04')), null);
  assert.equal(activeSeason(day('2026-10-25')).key, 'halloween');
  assert.equal(activeSeason(day('2027-01-01')).key, 'yule');
});

test('windows never overlap, so a day has at most one season', () => {
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d++) {
      const date = new Date(Date.UTC(2026, m - 1, d, 12));
      assert.ok(SEASONS.filter((s) => inSeason(s, date)).length <= 1, `two seasons on ${m}/${d}`);
    }
  }
});

test('the evaluation is in UTC, whatever the date object was built from', () => {
  assert.equal(inSeason(halloween, new Date('2026-10-17T00:00:00Z')), true);
  assert.equal(inSeason(halloween, new Date('2026-10-16T23:59:59Z')), false);
});

test('a season that crosses New Year is keyed by the year it started in', () => {
  assert.equal(seasonKey(yule, day('2026-12-26')), 'yule-2026');
  assert.equal(seasonKey(yule, day('2027-01-01')), 'yule-2026', 'New Year is still the Yule that began in December');
  assert.equal(seasonYear(yule, day('2027-01-02')), 2026);
  assert.equal(seasonKey(halloween, day('2026-10-31')), 'halloween-2026');
  assert.equal(seasonKey(halloween, day('2027-10-31')), 'halloween-2027', 'each year is its own occurrence');
});

test('a stored key reads back to its season and year, and junk reads back to null', () => {
  assert.deepEqual(seasonFromKey('yule-2026'), { season: yule, year: 2026 });
  assert.equal(seasonFromKey('easter-2026'), null);
  assert.equal(seasonFromKey('halloween'), null);
  assert.equal(seasonFromKey(null), null);
});

test('a leap day falls outside every season', () => {
  assert.equal(activeSeason(day('2028-02-29')), null);
});

const tagged = (n, theme) => Array.from({ length: n }, (_, i) => ({ id: `${theme}-${i}`, themes: [theme] }));

test('the pool is exactly the questions carrying the theme, and tolerates untagged rows', () => {
  const bank = [...tagged(3, 'halloween'), ...tagged(2, 'yule'), { id: 'plain', themes: [] }, { id: 'old' }];
  assert.equal(seasonPool(halloween, bank).length, 3);
  assert.equal(seasonPool(yule, bank).length, 2);
});

test('a season that cannot field a bundle has no spec, and one that can has a themed, unfiltered one', () => {
  assert.equal(seasonalChallengeSpec(halloween, tagged(MIN_SEASON_POOL - 1, 'halloween')), null);
  assert.deepEqual(seasonalChallengeSpec(halloween, tagged(MIN_SEASON_POOL, 'halloween')), {
    theme: 'halloween',
    category: null,
    canonSource: 'combined',
    difficulty: null,
  });
});
