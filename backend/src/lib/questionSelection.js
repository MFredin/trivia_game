// Choosing which questions make up a run: filter the bank by category, difficulty and canon (books, movies or
// both), then draw without repeats.
//
// Everything here is pure and takes its random source as an argument (`rng`), so a given seed always gives the same
// run. That is how the Daily Challenge works (the day's date seeds the draw, so everyone gets the same ten
// questions) and how tests can assert on a selection. Where the books and the films disagree, "combined" mode
// favours the questions that depend on the difference.

const DIVERGENCE_WEIGHT_IN_COMBINED = 3;

function filterByCanonSource(questions, canonSource) {
  if (canonSource === 'books') {
    return questions.filter((q) => q.canon_tags.includes('book') || q.canon_tags.includes('both'));
  }
  if (canonSource === 'movies') {
    return questions.filter((q) => q.canon_tags.includes('movie') || q.canon_tags.includes('both'));
  }
  return questions;
}

function weightFor(question, canonSource) {
  if (canonSource === 'combined' && question.divergence) return DIVERGENCE_WEIGHT_IN_COMBINED;
  return 1;
}

function weightedPick(remaining, canonSource, rng) {
  const weights = remaining.map((q) => weightFor(q, canonSource));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = rng() * total;
  for (let i = 0; i < remaining.length; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  return remaining.length - 1;
}

export function selectQuestionSet({
  questions,
  category,
  canonSource,
  obscurityTier,
  theme,
  count,
  excludeIds = new Set(),
  rng,
}) {
  let pool = category ? questions.filter((q) => q.category === category) : questions.slice();
  // A season's run draws only on the questions tagged for its occasion.
  if (theme) pool = pool.filter((q) => Array.isArray(q.themes) && q.themes.includes(theme));
  if (obscurityTier) pool = pool.filter((q) => q.obscurity_tier === obscurityTier);
  pool = filterByCanonSource(pool, canonSource).filter((q) => !excludeIds.has(q.id));

  const remaining = pool.slice();
  const chosen = [];
  const n = Math.min(count, remaining.length);
  for (let i = 0; i < n; i++) {
    const index = weightedPick(remaining, canonSource, rng);
    chosen.push(remaining[index]);
    remaining.splice(index, 1);
  }
  return chosen;
}

export function shuffle(array, rng) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Deterministic PRNG (mulberry32) so every player gets the same Daily Challenge set for a given day.
export function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

export function dailyKeyFor(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
