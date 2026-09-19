// The six reactions, and the only place their labels live. The server keeps the ids alone
// (backend/src/lib/duelReactions.js) and validates against those, so adding a reaction means
// touching both — but there is no duplicated display text to fall out of step.
//
// A plain constant rather than something fetched: six fixed strings that change only when the
// code does, so a round trip to learn them would buy nothing.
//
// Text rather than emoji: the rest of the app is set in a book, and these read as marginalia.
export const DUEL_REACTIONS = [
  { id: 'well_played', label: 'Well played' },
  { id: 'nice_one', label: 'Nice one' },
  { id: 'ouch', label: 'Ouch' },
  { id: 'so_close', label: 'So close' },
  { id: 'good_luck', label: 'Good luck' },
  { id: 'bring_it', label: 'Bring it on' },
];

const BY_ID = new Map(DUEL_REACTIONS.map((r) => [r.id, r]));

export function duelReactionLabel(id) {
  return BY_ID.get(id)?.label ?? null;
}
