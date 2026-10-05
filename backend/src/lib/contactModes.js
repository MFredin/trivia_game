// Who may start something with a player — an owl, a duel invite. The same three choices for each:
// 'open' is everyone (the default for a new account), 'friends' is friends only, 'off' is no one —
// and, so it is not a one-way street, a player who has it off may not start one either.
export const CONTACT_MODES = ['open', 'friends', 'off'];

/** Whether a player whose setting is `mode` accepts an approach from someone who is, or is not, a friend. */
export function contactAllowed(mode, isFriend) {
  return mode === 'open' || (mode === 'friends' && Boolean(isFriend));
}
