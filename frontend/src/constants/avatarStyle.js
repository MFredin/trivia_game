import { dotGrid, grid, rays, rings, weave } from '../lib/avatarGeometry.js';

// How an avatar can be dressed: shape, colour, background pattern, frame, corner mark. The ids
// are what the server stores (users.avatar_style) and validates against
// (backend/src/lib/avatarStyle.js); backend/test/avatarStyle.test.js fails when the two drift.
// Which choices are earned rather than free is the server's to say — it sends the list — so
// nothing about unlocks is duplicated here.
//
// Everything is drawn on one 48-unit square so the pieces compose: a shape, a pattern clipped to
// it, frames that are the shape scaled inwards, and a corner mark.
const DEFAULT_STYLE = { shape: 'circle', color: 'house', pattern: 'plain', frame: 'none', mark: 'none' };

export const AVATAR_STYLE_LAYERS = {
  shape: [
    { id: 'circle', label: 'Circle', path: 'M24 3a21 21 0 1 0 0 42 21 21 0 0 0 0-42z' },
    { id: 'rounded', label: 'Rounded square', path: 'M15 3h18a12 12 0 0 1 12 12v18a12 12 0 0 1-12 12H15A12 12 0 0 1 3 33V15A12 12 0 0 1 15 3z' },
    { id: 'hexagon', label: 'Hexagon', path: 'M24 2 43 13v22L24 46 5 35V13z' },
    { id: 'octagon', label: 'Octagon', path: 'M15 3h18l12 12v18L33 45H15L3 33V15z' },
  ],
  // `house` is the owner's own binding, resolved at draw time; the rest are fixed discs with the
  // colour the sigil is drawn in. Every pair clears 3:1 (scripts/contrast-audit.mjs checks them).
  color: [
    { id: 'house', label: 'Your house' },
    { id: 'scarlet', label: 'Scarlet', disc: '#2b0607', deep: '#190304', mark: '#ecb939' },
    { id: 'gold', label: 'Gold', disc: '#1c1712', deep: '#100d0a', mark: '#ecb939' },
    { id: 'green', label: 'Green', disc: '#0a1a13', deep: '#050d0a', mark: '#aaaaaa' },
    { id: 'blue', label: 'Blue', disc: '#0a1330', deep: '#060a1e', mark: '#b98d52' },
    { id: 'mono', label: 'Ink', disc: '#161616', deep: '#0b0b0b', mark: '#e6e6e6' },
    { id: 'parchment', label: 'Parchment', disc: '#e6d5ae', deep: '#d3be8a', mark: '#241b10' },
    { id: 'violet', label: 'Violet', disc: '#2a1240', deep: '#170923', mark: '#d9b8ff' },
    { id: 'teal', label: 'Teal', disc: '#08302f', deep: '#041a1a', mark: '#7fe0d4' },
    { id: 'rust', label: 'Rust', disc: '#4a1d0a', deep: '#2a0f04', mark: '#f2b27a' },
  ],
  // Stroked in the sigil colour at low opacity, clipped to the shape: texture, never a rival to
  // the sigil.
  pattern: [
    { id: 'plain', label: 'Plain' },
    { id: 'dots', label: 'Dots', d: dotGrid(), fill: true },
    { id: 'rays', label: 'Rays', d: rays() },
    { id: 'rings', label: 'Rings', d: rings() },
    { id: 'grid', label: 'Grid', d: grid() },
    { id: 'weave', label: 'Weave', d: weave() },
  ],
  // Each ring is the shape scaled in about the centre (`scale`), stroked `width` wide.
  frame: [
    { id: 'none', label: 'None', rings: [] },
    { id: 'ring', label: 'Ring', rings: [{ scale: 0.93, width: 1.6 }] },
    { id: 'double', label: 'Double ring', rings: [{ scale: 0.95, width: 1.4 }, { scale: 0.84, width: 0.9 }] },
    { id: 'dotted', label: 'Dotted', rings: [{ scale: 0.92, width: 2.2, dash: '0.1 3.4', round: true }] },
    { id: 'notched', label: 'Notched', rings: [{ scale: 0.92, width: 3, dash: '5 3' }] },
    { id: 'gilt', label: 'Gilt', rings: [{ scale: 0.95, width: 2.6, gilt: true }, { scale: 0.85, width: 0.9 }] },
  ],
  // A corner mark reuses a sigil's drawing (`sigil`), or is a plain dot (`pip`).
  mark: [
    { id: 'none', label: 'None' },
    { id: 'star', label: 'Star', sigil: 'star' },
    { id: 'moon', label: 'Moon', sigil: 'moon' },
    { id: 'pip', label: 'Dot', pip: true },
    { id: 'crown', label: 'Crown', sigil: 'crown' },
    { id: 'flame', label: 'Flame', sigil: 'flame' },
  ],
};

export const LAYER_LABELS = {
  shape: 'Shape',
  color: 'Colour',
  pattern: 'Pattern',
  frame: 'Frame',
  mark: 'Corner mark',
};

export const AVATAR_LAYER_BY_ID = Object.fromEntries(
  Object.entries(AVATAR_STYLE_LAYERS).map(([layer, options]) => [layer, Object.fromEntries(options.map((o) => [o.id, o]))]),
);

/** A complete style from whatever the server holds, falling back to the default for anything missing or unknown. */
export function resolveStyle(style) {
  const out = { ...DEFAULT_STYLE };
  for (const layer of Object.keys(DEFAULT_STYLE)) {
    const id = style?.[layer];
    if (id && AVATAR_LAYER_BY_ID[layer][id]) out[layer] = id;
  }
  return out;
}
