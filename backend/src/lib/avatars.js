// The avatars a player can pick. An avatar is never an uploaded image — CLAUDE.md rules out
// image files, and an upload would also make every profile a moderation surface — it is the id
// of a sigil the frontend draws from inline SVG primitives (frontend/src/constants/avatarSigils.js),
// set on the disc of the owner's house colours. NULL means "no sigil picked": the frontend draws
// the player's initial instead, so a new account has an avatar before it has made any choice.
//
// The ids below must stay in step with that frontend file; test/avatars.test.js fails if they
// drift, because a sigil the server accepts but the client cannot draw would render as a blank disc.
export const AVATAR_SIGILS = [
  'quill',
  'key',
  'candle',
  'scroll',
  'lantern',
  'hourglass',
  'compass',
  'chalice',
  'tome',
  'moon',
  'star',
  'sun',
  'comet',
  'leaf',
  'flame',
  'drop',
  'bell',
  'arch',
  'tower',
  'spiral',
  'knot',
  'constellation',
  'anchor',
  'crown',
];

export function isValidAvatar(value) {
  return value === null || AVATAR_SIGILS.includes(value);
}
