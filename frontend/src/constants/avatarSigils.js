// The sigils a player can wear as an avatar, drawn from SVG path primitives on a 24x24 grid —
// no image files, per CLAUDE.md. Each is a handful of strokes in `currentColor`; a shape marked
// `fill` is a solid dot (the stars of the constellation). They are deliberately generic objects
// of a library — a quill, a key, a candle — and not any house's emblem, animal or wand.
//
// The ids here are what the server stores in users.avatar, and backend/src/lib/avatars.js holds
// the allow-list it validates against. backend/test/avatars.test.js fails when the two drift.
export const AVATAR_SIGILS = [
  { id: 'quill', label: 'Quill', shapes: [{ d: 'M19 4c-6 0-11 4-12 11l-3 5 5-3c7-1 11-6 10-13z' }, { d: 'M7 17 15 9' }] },
  {
    id: 'key',
    label: 'Key',
    shapes: [{ d: 'M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z' }, { d: 'M10.5 10.5 20 20' }, { d: 'M16 16l2.5-2.5' }, { d: 'M18.5 18.5l2-2' }],
  },
  {
    id: 'candle',
    label: 'Candle',
    shapes: [{ d: 'M9 11h6v10H9z' }, { d: 'M12 3c2 2.5 2.5 4 0 6-2.5-2-2-3.5 0-6z' }, { d: 'M12 9v2' }],
  },
  { id: 'scroll', label: 'Scroll', shapes: [{ d: 'M7 4h11v13a3 3 0 0 1-3 3H6a3 3 0 0 0 3-3V6a2 2 0 0 0-2-2z' }, { d: 'M12 8h4M12 11h4' }] },
  {
    id: 'lantern',
    label: 'Lantern',
    shapes: [{ d: 'M9 6h6l2 3v8l-2 3H9l-2-3V9z' }, { d: 'M10 3h4v3h-4z' }, { d: 'M12 10c1.5 1.5 1.5 3 0 4-1.5-1-1.5-2.5 0-4z' }],
  },
  {
    id: 'hourglass',
    label: 'Hourglass',
    shapes: [{ d: 'M6 3h12M6 21h12' }, { d: 'M8 3v3c0 3 4 4.5 4 6s-4 3-4 6v3M16 3v3c0 3-4 4.5-4 6s4 3 4 6v3' }],
  },
  {
    id: 'compass',
    label: 'Compass',
    shapes: [{ d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' }, { d: 'M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z' }],
  },
  { id: 'chalice', label: 'Chalice', shapes: [{ d: 'M6 4h12c0 5-2 8-6 8s-6-3-6-8z' }, { d: 'M12 12v7M8 20h8' }] },
  {
    id: 'tome',
    label: 'Tome',
    shapes: [{ d: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z' }, { d: 'M5 17a3 3 0 0 1 3-3h11' }, { d: 'M9 8h6' }],
  },
  { id: 'moon', label: 'Crescent moon', shapes: [{ d: 'M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5z' }] },
  { id: 'star', label: 'Star', shapes: [{ d: 'M12 3c.8 5 3 7.2 9 9-6 1.8-8.2 4-9 9-.8-5-3-7.2-9-9 6-1.8 8.2-4 9-9z' }] },
  {
    id: 'sun',
    label: 'Sun',
    shapes: [{ d: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' }, { d: 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2' }],
  },
  {
    id: 'comet',
    label: 'Comet',
    shapes: [{ d: 'M16 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' }, { d: 'M13.5 13.5 4 4M11 16 3 13M16 11 13 3' }],
  },
  { id: 'leaf', label: 'Leaf', shapes: [{ d: 'M5 19C5 10 10 5 20 5c0 10-5 15-14 14z' }, { d: 'M5 19 14 10' }] },
  {
    id: 'flame',
    label: 'Flame',
    shapes: [{ d: 'M12 3c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-.5-6 1-9z' }],
  },
  { id: 'drop', label: 'Droplet', shapes: [{ d: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z' }] },
  { id: 'bell', label: 'Bell', shapes: [{ d: 'M6 17c1-2 1-4 1-7a5 5 0 0 1 10 0c0 3 0 5 1 7z' }, { d: 'M10 20a2 2 0 0 0 4 0' }, { d: 'M12 3v2' }] },
  {
    id: 'arch',
    label: 'Archway',
    shapes: [{ d: 'M5 21V11a7 7 0 0 1 14 0v10M9.5 21v-8a2.5 2.5 0 0 1 5 0v8M3 21h18' }],
  },
  {
    id: 'tower',
    label: 'Tower',
    shapes: [{ d: 'M8 21V9h8v12' }, { d: 'M6 9V4h2.5v2h2V4h3v2h2V4H18v5z' }, { d: 'M10.5 21v-3a1.5 1.5 0 0 1 3 0v3' }],
  },
  { id: 'spiral', label: 'Spiral', shapes: [{ d: 'M12 12a1.5 1.5 0 0 1 3 0 3.5 3.5 0 0 1-7 0 5.5 5.5 0 0 1 11 0 7.5 7.5 0 0 1-15 0' }] },
  {
    id: 'knot',
    label: 'Linked rings',
    shapes: [{ d: 'M9 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z' }, { d: 'M15 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z' }],
  },
  {
    id: 'constellation',
    label: 'Constellation',
    shapes: [
      { d: 'M5 17 9 9l6 4 4-8' },
      { d: 'M5 15.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', fill: true },
      { d: 'M9 7.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', fill: true },
      { d: 'M15 11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', fill: true },
      { d: 'M19 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', fill: true },
    ],
  },
  {
    id: 'anchor',
    label: 'Anchor',
    shapes: [{ d: 'M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' }, { d: 'M12 7v14M7 11h10' }, { d: 'M5 15c0 3 3 6 7 6s7-3 7-6' }],
  },
  { id: 'crown', label: 'Crown', shapes: [{ d: 'M4 18 3 8l5 4 4-7 4 7 5-4-1 10z' }, { d: 'M4 21h16' }] },
];

export const AVATAR_SIGIL_BY_ID = Object.fromEntries(AVATAR_SIGILS.map((s) => [s.id, s]));
