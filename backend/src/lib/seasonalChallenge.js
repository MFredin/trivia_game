import { MIN_SEASON_POOL } from './seasons.js';

// The spec for a season's run: the sibling of featuredChallengeSpec (lib/featuredChallenge.js). A seasonal run draws
// only on the questions tagged with the season's theme, across every category and both canons and every difficulty,
// so it plays like a Classic run with a theme rather than a narrow quiz.
//
// Checked against the real bank, because a season that cannot field a full bundle is worse than none: it would fail
// at the moment a player pressed Begin. If the pool is too thin this returns null and the season is simply not
// offered, which costs players nothing.

/** The questions that belong to a season. */
export function seasonPool(season, questions) {
  return questions.filter((q) => Array.isArray(q.themes) && q.themes.includes(season.theme));
}

/** The spec for a season, or null if the bank cannot field it. */
export function seasonalChallengeSpec(season, questions, minPool = MIN_SEASON_POOL) {
  if (seasonPool(season, questions).length < minPool) return null;
  return { theme: season.theme, category: null, canonSource: 'combined', difficulty: null };
}
