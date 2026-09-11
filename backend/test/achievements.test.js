import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS } from '../src/lib/achievements.js';
import { CONDITIONS } from '../src/services/achievements.js';

const baseStats = {
  totalCompleted: 0,
  flawlessRuns: 0,
  newtRuns: 0,
  phoenixRuns: 0,
  maxStreak: 0,
  blitzHighScore: 0,
  categoriesPlayed: 0,
  totalCategories: 11,
  booksOnlyRuns: 0,
  moviesOnlyRuns: 0,
  dailyDays: 0,
  maxEndurancePosition: 0,
  friendCount: 0,
  duelsCompleted: 0,
  duelsWon: 0,
};

test('every achievement in the catalog has a matching condition and a unique id', () => {
  const ids = new Set();
  for (const def of ACHIEVEMENTS) {
    assert.equal(ids.has(def.id), false, `duplicate achievement id: ${def.id}`);
    ids.add(def.id);
    assert.equal(typeof CONDITIONS[def.id], 'function', `missing condition for ${def.id}`);
  }
});

test('milestone conditions gate on total completed runs', () => {
  assert.equal(CONDITIONS.milestone_1({ ...baseStats, totalCompleted: 0 }), false);
  assert.equal(CONDITIONS.milestone_1({ ...baseStats, totalCompleted: 1 }), true);
  assert.equal(CONDITIONS.milestone_150({ ...baseStats, totalCompleted: 149 }), false);
  assert.equal(CONDITIONS.milestone_150({ ...baseStats, totalCompleted: 150 }), true);
});

test('streak conditions gate on max streak reached, not final streak', () => {
  assert.equal(CONDITIONS.streak_20({ ...baseStats, maxStreak: 19 }), false);
  assert.equal(CONDITIONS.streak_20({ ...baseStats, maxStreak: 20 }), true);
});

test('explorer_all_categories requires playing every known category', () => {
  assert.equal(CONDITIONS.explorer_all_categories({ ...baseStats, totalCategories: 11, categoriesPlayed: 10 }), false);
  assert.equal(CONDITIONS.explorer_all_categories({ ...baseStats, totalCategories: 11, categoriesPlayed: 11 }), true);
  // A zero-category catalog (e.g. empty question bank) should never trivially unlock this.
  assert.equal(CONDITIONS.explorer_all_categories({ ...baseStats, totalCategories: 0, categoriesPlayed: 0 }), false);
});

test('social_duel_wins_5 gates on duel wins, not duels played', () => {
  assert.equal(CONDITIONS.social_duel_wins_5({ ...baseStats, duelsCompleted: 5, duelsWon: 4 }), false);
  assert.equal(CONDITIONS.social_duel_wins_5({ ...baseStats, duelsCompleted: 5, duelsWon: 5 }), true);
});
