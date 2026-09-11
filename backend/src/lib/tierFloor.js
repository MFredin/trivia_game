import { OBSCURITY_TIERS } from './difficultyTiers.js';

// Classic mode's first 4 questions (when "Any difficulty" is selected) each guarantee a
// different obscurity tier — easiest to hardest — so every run has a comparable point
// ceiling instead of being at the mercy of the weighted-random draw. Remaining positions
// stay unconstrained so a "perfect" run is still rare and worth chasing.
export function tierFloorForPosition(position, questionCount) {
  if (questionCount < OBSCURITY_TIERS.length || position >= OBSCURITY_TIERS.length) {
    return null;
  }
  return OBSCURITY_TIERS[position];
}
