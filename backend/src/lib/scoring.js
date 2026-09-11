const BASE_POINTS_BY_OBSCURITY_TIER = {
  'First Year': 100,
  'O.W.L.': 150,
  'N.E.W.T.': 200,
  'Order of the Phoenix': 250,
};

const DESIGN_TIER_MULTIPLIER = {
  Direct: 1.0,
  'Some distractors': 1.1,
  'Trick phrasing': 1.25,
  'Requires cross-referencing': 1.4,
};

const DIVERGENCE_MULTIPLIER = 1.2;
const STREAK_BONUS_PER_STEP = 0.05;
const STREAK_BONUS_CAP = 0.5;
const TIME_BONUS_MAX_FRACTION = 0.5;

export function computeScore({ correct, elapsedMs, timeLimitMs, obscurityTier, designTier, divergence, streakBefore }) {
  if (!correct) {
    return { points: 0, streakAfter: 0 };
  }

  const base = BASE_POINTS_BY_OBSCURITY_TIER[obscurityTier] ?? 100;
  const designMultiplier = DESIGN_TIER_MULTIPLIER[designTier] ?? 1.0;
  const divergenceMultiplier = divergence ? DIVERGENCE_MULTIPLIER : 1.0;
  const streakMultiplier = 1 + Math.min(streakBefore * STREAK_BONUS_PER_STEP, STREAK_BONUS_CAP);

  const remainingFraction = Math.max(0, 1 - elapsedMs / timeLimitMs);
  const timeBonusFraction = TIME_BONUS_MAX_FRACTION * remainingFraction;

  const points = Math.round(
    base * designMultiplier * divergenceMultiplier * streakMultiplier * (1 + timeBonusFraction),
  );

  return { points, streakAfter: streakBefore + 1 };
}
