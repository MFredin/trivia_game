// What a moderator can do about a report: the ids are the server's (backend/src/lib/moderation.js
// refuses anything else), the words are the interface's. `effect` is what the action does — said
// plainly, because the screen used to say "Action taken" and nobody could tell what that meant.
const MODERATION_ACTIONS = [
  { id: 'warn', label: 'Warn', effect: 'Sends them a notice they have to acknowledge. Nothing else changes.' },
  { id: 'force_rename', label: 'Force rename', effect: 'Replaces their name with a neutral one. They must choose a new name before they can carry on.' },
  { id: 'clear_bio', label: 'Clear bio', effect: 'Removes their bio.' },
  { id: 'reset_avatar', label: 'Reset avatar', effect: 'Puts their avatar back to the default.' },
  { id: 'remove_scores', label: 'Remove scores', effect: 'Takes all their completed runs off the leaderboards. Nothing is deleted, and it can be undone in the database.' },
  { id: 'suspend', label: 'Suspend', effect: 'Locks them out for 1, 7 or 30 days. They are shown your note when they try to sign in.' },
  { id: 'ban', label: 'Ban', effect: 'Locks them out until a moderator lifts it, and stops the same email address being used to register again.' },
];

export const MODERATION_ACTION_BY_ID = Object.fromEntries(MODERATION_ACTIONS.map((a) => [a.id, a]));

export const NOTE_MIN = 10;
export const NOTE_MAX = 1000;

const REASON_PHRASE = {
  offensive_name: 'Your username broke the house rules.',
  offensive_bio: 'Your bio broke the house rules.',
  harassment: 'You were reported for harassing another player, and a moderator found it broke the house rules.',
  impersonation: 'You were reported for pretending to be someone else, and a moderator found it broke the house rules.',
  cheating: 'Your scores were reported as cheating, and a moderator found it broke the house rules.',
  other: 'You were reported, and a moderator found it broke the house rules.',
};

const ACTION_PHRASE = {
  warn: 'Please keep to the house rules from here on. A repeat may lead to a suspension.',
  force_rename: 'Your name has been changed, and you will need to choose a new one.',
  clear_bio: 'Your bio has been removed.',
  reset_avatar: 'Your avatar has been reset.',
  remove_scores: 'Your scores have been removed from the leaderboards.',
  suspend: (days) => `Your account is suspended for ${days} day${days === 1 ? '' : 's'}.`,
  ban: 'Your account has been banned.',
};

/** A starting point for the note the player will read — written for them, and editable. */
export function suggestedNote(reason, actions, days) {
  const phrases = actions.map((a) => (a === 'suspend' ? ACTION_PHRASE.suspend(days) : ACTION_PHRASE[a]));
  return [REASON_PHRASE[reason] ?? REASON_PHRASE.other, ...phrases].join(' ');
}
