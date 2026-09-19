import { mulberry32, seedFromString } from './questionSelection.js';

// The Daily Challenge is one fixed set for everyone, every day. This is its weekly sibling:
// a themed quiz that rotates on Monday, picked deterministically from the ISO week key so
// every player gets the same one without anything needing to be scheduled or stored ahead
// of time. Same trick the daily seed already uses, one rung up.

// Weighted toward 'combined' so most weeks draw on the whole bank; books-only and
// movies-only weeks are the occasional change of pace, not the norm.
const CANON_WEIGHTS = [
  ['combined', 6],
  ['books', 2],
  ['movies', 2],
];

// Deliberately no difficulty filter. A category already narrows the pool, and stacking a
// tier on top of it is how you end up with a themed week that cannot field ten questions.
// Difficulty stays mixed, which also keeps the featured run comparable to a Classic run.
const MIN_POOL = 10;

function weightedPick(weights, rng) {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [value, weight] of weights) {
    if (r < weight) return value;
    r -= weight;
  }
  return weights[weights.length - 1][0];
}

function poolSize(questions, category, canonSource) {
  return questions.filter((q) => {
    if (q.category !== category) return false;
    if (canonSource === 'books') return q.canon_tags.includes('book') || q.canon_tags.includes('both');
    if (canonSource === 'movies') return q.canon_tags.includes('movie') || q.canon_tags.includes('both');
    return true;
  }).length;
}

/**
 * The spec for a given ISO week — same input, same output, forever.
 *
 * The chosen combination is checked against the real bank before it is returned, because a
 * themed week that cannot field a full run is worse than a less exotic one: it would fail at
 * the moment a player pressed Begin. If the pick is too thin it falls back to 'combined' for
 * that category, and only then to another category.
 */
export function featuredChallengeSpec(weekKey, questions) {
  const categories = [...new Set(questions.map((q) => q.category))].sort();
  if (categories.length === 0) return null;

  const rng = mulberry32(seedFromString(`featured:${weekKey}`));
  const category = categories[Math.floor(rng() * categories.length)];
  const canonSource = weightedPick(CANON_WEIGHTS, rng);

  if (poolSize(questions, category, canonSource) >= MIN_POOL) {
    return { category, canonSource, difficulty: null };
  }
  if (poolSize(questions, category, 'combined') >= MIN_POOL) {
    return { category, canonSource: 'combined', difficulty: null };
  }
  // Rotate deterministically through the rest rather than picking at random again, so the
  // fallback is as reproducible as the first choice.
  const start = categories.indexOf(category);
  for (let i = 1; i < categories.length; i++) {
    const next = categories[(start + i) % categories.length];
    if (poolSize(questions, next, 'combined') >= MIN_POOL) {
      return { category: next, canonSource: 'combined', difficulty: null };
    }
  }
  return null;
}
