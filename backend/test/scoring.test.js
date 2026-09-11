import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore } from '../src/lib/scoring.js';

test('incorrect answers score zero and reset streak', () => {
  const { points, streakAfter } = computeScore({
    correct: false,
    elapsedMs: 1000,
    timeLimitMs: 20000,
    obscurityTier: 'N.E.W.T.',
    designTier: 'Trick phrasing',
    divergence: false,
    streakBefore: 5,
  });
  assert.equal(points, 0);
  assert.equal(streakAfter, 0);
});

test('correct answers score more for harder tiers and divergence questions', () => {
  const easy = computeScore({
    correct: true,
    elapsedMs: 10000,
    timeLimitMs: 20000,
    obscurityTier: 'First Year',
    designTier: 'Direct',
    divergence: false,
    streakBefore: 0,
  });
  const hard = computeScore({
    correct: true,
    elapsedMs: 10000,
    timeLimitMs: 20000,
    obscurityTier: 'Order of the Phoenix',
    designTier: 'Requires cross-referencing',
    divergence: true,
    streakBefore: 0,
  });
  assert.ok(hard.points > easy.points);
  assert.equal(easy.streakAfter, 1);
});

test('faster answers score at least as many points as slower ones', () => {
  const fast = computeScore({
    correct: true,
    elapsedMs: 100,
    timeLimitMs: 20000,
    obscurityTier: 'O.W.L.',
    designTier: 'Direct',
    divergence: false,
    streakBefore: 0,
  });
  const slow = computeScore({
    correct: true,
    elapsedMs: 19000,
    timeLimitMs: 20000,
    obscurityTier: 'O.W.L.',
    designTier: 'Direct',
    divergence: false,
    streakBefore: 0,
  });
  assert.ok(fast.points > slow.points);
});

test('streak increases score for consecutive correct answers', () => {
  const noStreak = computeScore({
    correct: true,
    elapsedMs: 10000,
    timeLimitMs: 20000,
    obscurityTier: 'O.W.L.',
    designTier: 'Direct',
    divergence: false,
    streakBefore: 0,
  });
  const withStreak = computeScore({
    correct: true,
    elapsedMs: 10000,
    timeLimitMs: 20000,
    obscurityTier: 'O.W.L.',
    designTier: 'Direct',
    divergence: false,
    streakBefore: 8,
  });
  assert.ok(withStreak.points > noStreak.points);
});
