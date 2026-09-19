// Mirrors backend/src/lib/duelReactions.js. Kept as a plain constant rather than fetched:
// it is six fixed strings that change only when the code does, so a round trip to learn them
// would buy nothing. The server validates the id it receives regardless of what this says.
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
