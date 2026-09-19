// A closed set, deliberately. Free-text chat in a two-player game needs moderation, reporting
// and a retention policy; a fixed vocabulary needs none of that and still covers what players
// actually want to say mid-duel. Nothing here can be aimed at someone in a way that requires
// a moderator, which is the whole point.
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

export function isDuelReaction(id) {
  return typeof id === 'string' && BY_ID.has(id);
}

export function duelReactionLabel(id) {
  return BY_ID.get(id)?.label ?? null;
}

// Reactions are the one thing a client can push at the server unprompted, so they get their
// own throttle. Per socket rather than per user: a second tab is a second socket, and the
// limit that matters is how fast frames arrive on one connection.
const LIMIT = 5;
const WINDOW_MS = 10000;

export function allowReaction(socket, now = Date.now()) {
  const recent = (socket.reactionTimes ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    socket.reactionTimes = recent;
    return false;
  }
  recent.push(now);
  socket.reactionTimes = recent;
  return true;
}
