// What a moderator can do about a report, and what the app suggests they do. Pure rules; the
// effects live in services/moderation.js.
//
// The aim is a ladder rather than a switch: a first offence of most kinds is a warning and a fix,
// a second is a suspension, a repeat is a ban — and the moderator sees that history, with a
// suggestion, on the report itself. They are free to ignore it. A suggestion is not a rule.
export const MODERATION_ACTIONS = ['warn', 'force_rename', 'clear_bio', 'reset_avatar', 'remove_scores', 'suspend', 'ban'];

export const SUSPENSION_DAYS = [1, 7, 30];

// Actions that end in the player being locked out: they cannot read a notice, so they are told at
// the login screen instead, and these rows are created already acknowledged.
export const LOCKOUT_ACTIONS = ['suspend', 'ban'];

// How far back "previous offences" reaches. A year-old warning should not tip a first report
// into a suspension.
export const HISTORY_DAYS = 180;

// Each rung is the set of actions suggested for that many previous actioned reports (the last
// rung repeats). Suggestions only: the moderator picks what is applied.
const LADDERS = {
  offensive_name: [['warn'], ['force_rename', 'warn'], ['suspend'], ['ban']],
  offensive_bio: [['clear_bio', 'warn'], ['clear_bio', 'suspend'], ['suspend'], ['ban']],
  harassment: [['warn'], ['suspend'], ['suspend'], ['ban']],
  impersonation: [['force_rename', 'warn'], ['suspend'], ['ban']],
  cheating: [['remove_scores', 'warn'], ['remove_scores', 'suspend'], ['ban']],
  other: [['warn'], ['suspend'], ['ban']],
};

// What a moderator is offered for a given kind of report: the actions on its ladder first, then
// everything else, so the right ones are on top and nothing is out of reach.
export function actionsFor(reason) {
  const onLadder = [...new Set((LADDERS[reason] ?? LADDERS.other).flat())];
  return [...onLadder, ...MODERATION_ACTIONS.filter((a) => !onLadder.includes(a))];
}

/**
 * The suggested next step for a report, given how many reports against this player have already
 * ended in action and how many suspensions they have had: `{ actions, days }`.
 */
export function suggestNext(reason, { priorActioned = 0, priorSuspensions = 0 } = {}) {
  const ladder = LADDERS[reason] ?? LADDERS.other;
  const actions = ladder[Math.min(priorActioned, ladder.length - 1)];
  const days = actions.includes('suspend') ? SUSPENSION_DAYS[Math.min(priorSuspensions, SUSPENSION_DAYS.length - 1)] : null;
  return { actions, days };
}

/** Why a set of actions cannot be applied together, or null if they can. */
export function checkActionSet(actions, days) {
  if (!Array.isArray(actions) || actions.length === 0) return 'no_actions';
  if (!actions.every((a) => MODERATION_ACTIONS.includes(a))) return 'invalid_action';
  if (new Set(actions).size !== actions.length) return 'invalid_action';
  if (actions.includes('ban') && actions.includes('suspend')) return 'ban_and_suspend';
  if (actions.includes('suspend') && !SUSPENSION_DAYS.includes(days)) return 'invalid_days';
  return null;
}

const LABELS = {
  warn: 'warned',
  force_rename: 'renamed',
  clear_bio: 'bio cleared',
  reset_avatar: 'avatar reset',
  remove_scores: 'scores removed',
  ban: 'banned',
};

/** "Warned; suspended 7 days" — a report's outcome in words. */
export function describeResolution(actions, days) {
  const parts = actions.map((a) => (a === 'suspend' ? `suspended ${days} day${days === 1 ? '' : 's'}` : LABELS[a]));
  const text = parts.join('; ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
