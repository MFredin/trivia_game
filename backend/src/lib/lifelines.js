// Lifelines are Classic-only on purpose. Daily and Challenge runs are compared directly
// against other players on the same fixed question set, and a scoreboard where some entries
// had help and others did not is not a scoreboard. Blitz, Survival and Gauntlet are endurance
// formats whose whole tension is that there is no safety net.
export const LIFELINE_MODES = ['classic'];

export const FIFTY_FIFTY = 'fifty_fifty';
export const SKIP = 'skip';
const LIFELINE_TYPES = [FIFTY_FIFTY, SKIP];

// One of each per run. Enough to change how a run is played, not enough to carry it.
export function lifelineAvailable(session, type) {
  if (!LIFELINE_TYPES.includes(type)) return false;
  if (!LIFELINE_MODES.includes(session.mode)) return false;
  return !(session.lifelines_used ?? []).includes(type);
}

// A 50-50 has to cost something or it is a free correct answer on the hardest question in the
// run, taken every time. Half the points is the plainest rule to explain and the easiest to
// reason about while playing: worth spending on a question you would otherwise miss, not one
// you already know.
const FIFTY_FIFTY_SCORE_MULTIPLIER = 0.5;

export function applyLifelineToScore(points, lifeline) {
  if (lifeline === SKIP) return 0;
  if (lifeline === FIFTY_FIFTY) return Math.round(points * FIFTY_FIFTY_SCORE_MULTIPLIER);
  return points;
}

/**
 * Which two wrong choices to hide.
 *
 * Computed here and never on the client: the client is handed a shuffled list of answers with
 * no idea which is right, and that is the entire anti-cheat model. Sending it enough to work
 * out the answer itself — even just "these two are wrong" derived locally — would hand it the
 * one thing it is not supposed to know.
 *
 * Deterministic in the question's own served order so that asking twice, or retrying after a
 * dropped response, hides the same two rather than narrowing the field further each time.
 */
export function fiftyFiftyHiddenIndices(correctChoiceIndex, choiceCount) {
  const wrong = [];
  for (let i = 0; i < choiceCount; i++) {
    if (i !== correctChoiceIndex) wrong.push(i);
  }
  // Keep two of the four on screen: the right answer and one wrong one. With fewer than four
  // choices, hide as many as can be spared while always leaving a decision to make.
  const toHide = Math.max(0, Math.min(wrong.length - 1, choiceCount - 2));
  return wrong.slice(0, toHide).sort((a, b) => a - b);
}
