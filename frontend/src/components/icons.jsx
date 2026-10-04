// Inline SVG glyphs for the app's controls, on a 24x24 grid in `currentColor` — no icon font and
// no image files, per CLAUDE.md. Each is a few strokes so it stays legible at 20px. Add a glyph
// here rather than drawing one inline in a component, so two buttons that mean the same thing
// cannot end up looking different.
const GLYPHS = {
  'user-plus': [{ d: 'M15 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 3 18.5V20' }, { d: 'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z' }, { d: 'M19 8v6M16 11h6' }],
  'user-minus': [{ d: 'M15 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 3 18.5V20' }, { d: 'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z' }, { d: 'M16 11h6' }],
  // A pennant: planting a flag is what a challenge is.
  flag: [{ d: 'M5 21V4' }, { d: 'M5 5h12l-2.5 4 2.5 4H5' }],
  check: [{ d: 'M5 12.5l4.5 4.5L19 7.5' }],
  x: [{ d: 'M6 6l12 12M18 6 6 18' }],
  ban: [{ d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' }, { d: 'M5.7 5.7l12.6 12.6' }],
  alert: [{ d: 'M12 4 3 20h18z' }, { d: 'M12 10v4M12 17.2v.1' }],
  user: [{ d: 'M12 4.5a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z' }, { d: 'M4.5 20v-1a5.5 5.5 0 0 1 5.5-5.5h4a5.5 5.5 0 0 1 5.5 5.5v1' }],
  cog: [
    { d: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
    { d: 'M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8' },
  ],
  logout: [{ d: 'M10 4H5v16h5' }, { d: 'M10 12h10M16 8l4 4-4 4' }],
  // Owl Post: an owl with its beak over a letter. An original drawing — round face, two small ear
  // tufts, a beak — kept to a few strokes so it still reads at 22px.
  owl: [
    { d: 'M5.5 4.8 8.6 6.6c2-.6 4.8-.6 6.8 0l3.1-1.8V10c0 2.6-2.6 4-6.5 4s-6.5-1.4-6.5-4z' },
    { d: 'M9.3 7.6a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM14.7 7.6a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z' },
    { d: 'M11 11.4h2L12 13z', fill: true },
    { d: 'M4.5 14h15v7h-15z' },
    { d: 'M4.5 14.5 12 19l7.5-4.5' },
  ],
  lock: [{ d: 'M6 11h12v9H6z' }, { d: 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3' }],
  edit: [{ d: 'M4 20h4L19 9l-4-4L4 16z' }, { d: 'M13.5 6.5l4 4' }],
  more: [
    { d: 'M5 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', fill: true },
    { d: 'M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', fill: true },
    { d: 'M19 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', fill: true },
  ],
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[name].map((shape, i) => (
        <path key={i} d={shape.d} fill={shape.fill ? 'currentColor' : 'none'} />
      ))}
    </svg>
  );
}
