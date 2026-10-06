import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SEASONS, SEASON_THEMES, MIN_SEASON_POOL } from '../src/lib/seasons.js';
import { seasonPool } from '../src/lib/seasonalChallenge.js';
import { OBSCURITY_TIERS } from '../src/lib/difficultyTiers.js';

// The gate that stops a season being listed before the bank can field it. A season in SEASONS that has too few tagged
// questions would be offered by lib/seasons.js and then quietly hidden by the route (seasonalChallengeSpec returns
// null), which is safe but means the bundle never appears. This makes that a loud failure at review time instead.
const bank = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'question-bank-full-draft.json'), 'utf-8'),
).questions;

test('every theme tag in the bank belongs to a listed season', () => {
  const unknown = new Set();
  for (const q of bank) for (const theme of q.themes ?? []) if (!SEASON_THEMES.includes(theme)) unknown.add(theme);
  assert.deepEqual([...unknown], [], 'a question carries a theme no season uses');
});

for (const season of SEASONS) {
  test(`the bank can field "${season.key}": ${MIN_SEASON_POOL}+ tagged, with every difficulty represented`, () => {
    const pool = seasonPool(season, bank);
    assert.ok(pool.length >= MIN_SEASON_POOL, `only ${pool.length} questions are tagged "${season.theme}"`);
    for (const tier of OBSCURITY_TIERS) {
      const n = pool.filter((q) => q.obscurity_tier === tier).length;
      assert.ok(n >= 5, `only ${n} "${season.theme}" questions at ${tier}`);
    }
  });
}
