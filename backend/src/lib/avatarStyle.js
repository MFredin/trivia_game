// How an avatar can be dressed. A sigil (lib/avatars.js) sits in a shape, on a colour, over an
// optional pattern, inside an optional frame, with an optional mark in the corner. Every choice
// is an id from a fixed list — the frontend draws them from SVG primitives, so there is nothing to
// upload and nothing a player can type — which is also what makes ~20,000 distinct looks safe to
// offer: each combination was drawn and contrast-checked by someone, not generated from input.
//
// The ids must stay in step with frontend/src/constants/avatarStyle.js; backend/test/avatarStyle.test.js
// fails if they drift, because an id the server accepts and the client cannot draw is a blank avatar.
export const AVATAR_OPTIONS = {
  shape: ['circle', 'rounded', 'hexagon', 'octagon'],
  color: ['house', 'scarlet', 'gold', 'green', 'blue', 'mono', 'parchment', 'violet', 'teal', 'rust'],
  pattern: ['plain', 'dots', 'rays', 'rings', 'grid', 'weave'],
  frame: ['none', 'ring', 'double', 'dotted', 'notched', 'gilt'],
  mark: ['none', 'star', 'moon', 'pip', 'crown', 'flame'],
};

// What a new account wears, and what any missing field means. 'house' as a colour is the disc in
// the owner's own binding colours, which is what every avatar was before this existed.
export const DEFAULT_AVATAR_STYLE = { shape: 'circle', color: 'house', pattern: 'plain', frame: 'none', mark: 'none' };

// A few choices are earned rather than given: an achievement unlocks them. Keyed "<layer>:<id>".
// Chosen to reward play without gating the basics — every layer has free options, and the colours
// are all free, so nobody is stuck with a worse-looking avatar for not having played.
export const AVATAR_UNLOCKS = {
  'pattern:grid': 'milestone_10',
  'pattern:weave': 'streak_10',
  'frame:double': 'milestone_1',
  'frame:notched': 'dedication_7',
  'frame:gilt': 'social_duel_wins_5',
  'mark:crown': 'mastery_flawless',
  'mark:flame': 'streak_20',
};

/**
 * A complete, valid style from whatever was sent, or null if any layer names something that does
 * not exist. Missing layers take the default, so `{ shape: 'hexagon' }` is a complete request.
 */
export function normalizeAvatarStyle(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return null;
  const style = { ...DEFAULT_AVATAR_STYLE };
  for (const [layer, value] of Object.entries(input)) {
    if (!(layer in AVATAR_OPTIONS)) return null;
    if (!AVATAR_OPTIONS[layer].includes(value)) return null;
    style[layer] = value;
  }
  return style;
}

/**
 * The earned choices in `style` that the player has not earned: [{ key, achievement_id }].
 * `alreadyHeld` is the style they have now — keeping a choice they already wear is never refused,
 * so retiring or re-gating an unlock later cannot lock someone out of saving anything else.
 */
export function lockedChoices(style, unlockedAchievementIds, alreadyHeld = DEFAULT_AVATAR_STYLE) {
  const unlocked = new Set(unlockedAchievementIds);
  const locked = [];
  for (const [layer, value] of Object.entries(style)) {
    const key = `${layer}:${value}`;
    const needs = AVATAR_UNLOCKS[key];
    if (!needs || unlocked.has(needs)) continue;
    if (alreadyHeld?.[layer] === value) continue;
    locked.push({ key, achievement_id: needs });
  }
  return locked;
}
