import test from 'node:test';
import assert from 'node:assert/strict';
import { detectRunAnomaly, MIN_ANSWERED_FOR_FLAG } from '../src/lib/anomalyDetection.js';

const TIME_LIMIT_MS = 20000;

// A run that should get flagged: every answer correct, every question at the hard end of the
// tier ladder, and every answer landing in the first few percent of the allowed time — the
// pattern the design doc calls out as "perfect accuracy at the hardest tier combined with
// near-minimum response times across an entire run".
function suspiciousAnswer(overrides = {}) {
  return {
    correct: true,
    timedOut: false,
    skipped: false,
    elapsedMs: 400,
    timeLimitMs: TIME_LIMIT_MS,
    obscurityTier: 'N.E.W.T.',
    ...overrides,
  };
}

function suspiciousRun(n = 10, overrides = {}) {
  return Array.from({ length: n }, () => suspiciousAnswer(overrides));
}

test('flags a perfect, hard-tier, near-instant run', () => {
  const { flagged, reason } = detectRunAnomaly(suspiciousRun());
  assert.equal(flagged, true);
  assert.match(reason, /perfect_accuracy_hard_tier_near_min_time/);
});

test('does not flag a fast-but-plausible run (times well above the near-minimum floor)', () => {
  // A knowledgeable, quick player: still answers everything right at the hardest tier, but
  // spends a genuine few seconds reading each question rather than tapping instantly — well
  // under half the clock, but nowhere near the near-minimum fraction this heuristic reserves
  // for a scripted lookup.
  const answers = [4000, 6000, 5000, 7000, 4500, 6500, 5000, 8000, 4000, 7000].map((elapsedMs) =>
    suspiciousAnswer({ elapsedMs }),
  );
  const { flagged } = detectRunAnomaly(answers);
  assert.equal(flagged, false);
});

test('does not flag a run below the minimum sample size', () => {
  const answers = suspiciousRun(MIN_ANSWERED_FOR_FLAG - 1);
  const { flagged } = detectRunAnomaly(answers);
  assert.equal(flagged, false);
});

test('flags once the minimum sample size is reached', () => {
  const answers = suspiciousRun(MIN_ANSWERED_FOR_FLAG);
  const { flagged } = detectRunAnomaly(answers);
  assert.equal(flagged, true);
});

test('does not flag a run with any wrong or timed-out answer', () => {
  const withWrong = suspiciousRun(9).concat(suspiciousAnswer({ correct: false }));
  assert.equal(detectRunAnomaly(withWrong).flagged, false);

  const withTimeout = suspiciousRun(9).concat(suspiciousAnswer({ correct: false, timedOut: true }));
  assert.equal(detectRunAnomaly(withTimeout).flagged, false);
});

test('does not flag a perfect, instant run that is mostly easy-tier questions', () => {
  // Same timing profile, but the run isn't "at the hardest tier" — a player who stuck to First
  // Year questions and blitzed through them isn't the pattern this heuristic is after.
  const answers = suspiciousRun(10, { obscurityTier: 'First Year' });
  assert.equal(detectRunAnomaly(answers).flagged, false);
});

test('tolerates a minority of easy-tier questions in an otherwise hard-tier run', () => {
  const answers = suspiciousRun(9).concat(suspiciousAnswer({ obscurityTier: 'O.W.L.' }));
  // 9/10 = 90% hard tier, exactly at the threshold.
  assert.equal(detectRunAnomaly(answers).flagged, true);
});

test('does not flag when one answer is a slow outlier, even if the average still looks instant', () => {
  // Nine near-instant answers and one that took most of the clock: the average fraction can
  // still clear the strict average threshold, but the per-answer ceiling should not.
  const answers = suspiciousRun(9).concat(suspiciousAnswer({ elapsedMs: 15000 }));
  assert.equal(detectRunAnomaly(answers).flagged, false);
});

test('skipped answers are dropped from the sample rather than counted either way', () => {
  // Three real suspicious answers plus a pile of skips should NOT be enough to flag — skips
  // don't pad the sample size, so this stays under the minimum.
  const answers = suspiciousRun(3).concat(
    Array.from({ length: 10 }, () => suspiciousAnswer({ skipped: true, correct: false, elapsedMs: 0 })),
  );
  assert.equal(detectRunAnomaly(answers).flagged, false);
});
