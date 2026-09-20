// A closed set, deliberately. Free-text chat in a two-player game needs moderation, reporting
// and a retention policy; a fixed vocabulary needs none of that and still covers what players
// actually want to say mid-duel. Nothing here can be aimed at someone in a way that requires
// a moderator, which is the whole point.
//
// Ids only. The server's whole job here is to decide whether an incoming id is one of the
// six; the labels that go with them are display text, and they live where they are rendered
// (frontend/src/constants/duelReactions.js). Keeping a second copy of them here would be a
// copy nothing reads, free to drift.
const DUEL_REACTION_IDS = new Set(['well_played', 'nice_one', 'ouch', 'so_close', 'good_luck', 'bring_it']);

export function isDuelReaction(id) {
  return typeof id === 'string' && DUEL_REACTION_IDS.has(id);
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
