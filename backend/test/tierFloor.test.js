import test from 'node:test';
import assert from 'node:assert/strict';
import { tierFloorForPosition } from '../src/lib/tierFloor.js';
import { OBSCURITY_TIERS } from '../src/lib/difficultyTiers.js';

test('the first 4 positions of a 10-question run cover all 4 tiers, easiest to hardest', () => {
  const tiers = [0, 1, 2, 3].map((position) => tierFloorForPosition(position, 10));
  assert.deepEqual(tiers, OBSCURITY_TIERS);
});

test('positions beyond the floor are unconstrained', () => {
  for (let position = 4; position < 10; position++) {
    assert.equal(tierFloorForPosition(position, 10), null);
  }
});

test('a run shorter than the tier count has no floor at all', () => {
  for (let position = 0; position < 3; position++) {
    assert.equal(tierFloorForPosition(position, 3), null);
  }
});
