import { OBSCURITY_TIERS } from './difficultyTiers.js';

// The top half of the tier ladder — "the hardest tier" from the design doc's "perfect accuracy
// at the hardest tier" phrasing is read loosely as "the hard end of it", so a mixed N.E.W.T./
// Order-of-the-Phoenix run is treated the same as an all-Phoenix one.
export const HARD_OBSCURITY_TIERS = OBSCURITY_TIERS.slice(-2);

// Below this, a run is too short to tell a knowledgeable streak from a lucky one — a 3-question
// duel going 3-for-3 fast proves nothing. Every standard mode (10 questions) clears this easily;
// only clears the bar for a run of some length.
export const MIN_ANSWERED_FOR_FLAG = 5;

// How much of the run has to be at the hard end of the tier ladder before "perfect accuracy at
// the hardest tier" even applies. Not 100%: a player who filtered to "Any" difficulty but still
// happened to draw a mostly-hard set shouldn't dodge the check on a technicality.
export const HARD_TIER_FRACTION_THRESHOLD = 0.9;

// "Near-minimum response time" as a fraction of the time allowed per question. 12% of a 20s
// classic question is 2.4s — enough to read a four-way multiple choice and tap an answer only
// if the answer was already known cold before the question rendered (a scraped lookup, not a
// human reading it). A genuinely fast, knowledgeable player still spends more of the clock than
// this on most questions, even when they know the answer instantly, because reading still costs
// time the clock is running on.
export const AVG_ELAPSED_FRACTION_THRESHOLD = 0.12;

// The average alone can hide one slow outlier dragging it up while every other answer is
// suspiciously instant — so every answer in the run also has to stay under this looser ceiling.
// This is what "across an entire run" adds over "on average": a human's timing varies question
// to question; a script's doesn't.
export const MAX_ELAPSED_FRACTION_THRESHOLD = 0.25;

/**
 * Phase 2 anomaly heuristic (docs/anti-cheat-architecture.md): flags a completed run whose own
 * answers look implausible — perfect accuracy, concentrated at the hardest tier, with
 * suspiciously uniform near-zero response times. Pure function over the run's own answers so it
 * can be unit tested without a database.
 *
 * @param {Array<{correct: boolean, timedOut: boolean, skipped: boolean, elapsedMs: number, timeLimitMs: number, obscurityTier: string}>} answers
 * @returns {{flagged: boolean, reason: string|null}}
 */
export function detectRunAnomaly(answers) {
  // A skip is the player declining to answer — it carries no timing or accuracy signal, so it
  // is dropped from the sample rather than counted against (or for) the player.
  const scored = answers.filter((a) => !a.skipped);

  if (scored.length < MIN_ANSWERED_FOR_FLAG) {
    return { flagged: false, reason: null };
  }

  const allCorrect = scored.every((a) => a.correct && !a.timedOut);
  if (!allCorrect) {
    return { flagged: false, reason: null };
  }

  const hardCount = scored.filter((a) => HARD_OBSCURITY_TIERS.includes(a.obscurityTier)).length;
  const hardFraction = hardCount / scored.length;
  if (hardFraction < HARD_TIER_FRACTION_THRESHOLD) {
    return { flagged: false, reason: null };
  }

  const fractions = scored.map((a) => a.elapsedMs / a.timeLimitMs);
  const avgFraction = fractions.reduce((sum, f) => sum + f, 0) / fractions.length;
  const maxFraction = Math.max(...fractions);
  if (avgFraction > AVG_ELAPSED_FRACTION_THRESHOLD || maxFraction > MAX_ELAPSED_FRACTION_THRESHOLD) {
    return { flagged: false, reason: null };
  }

  return {
    flagged: true,
    reason:
      `perfect_accuracy_hard_tier_near_min_time ` +
      `(n=${scored.length}, hard_fraction=${hardFraction.toFixed(2)}, ` +
      `avg_elapsed_fraction=${avgFraction.toFixed(3)}, max_elapsed_fraction=${maxFraction.toFixed(3)})`,
  };
}
