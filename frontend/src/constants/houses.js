// Each house rebinds the same set of CSS custom properties (see styles/tokens.css) — the
// cover/accent hexes here are only for rendering the swatch chips on the Settings screen,
// not a second source of truth for the actual theme colors.
export const HOUSES = [
  { id: 'gryffindor', label: 'Gryffindor', cover: '#3a1012', coverDeep: '#220a0b', accent: '#dcae4c' },
  { id: 'hufflepuff', label: 'Hufflepuff', cover: '#2b2415', coverDeep: '#1a160c', accent: '#dba83d' },
  { id: 'slytherin', label: 'Slytherin', cover: '#0e2320', coverDeep: '#081514', accent: '#4fae82' },
  { id: 'ravenclaw', label: 'Ravenclaw', cover: '#101a30', coverDeep: '#0a111f', accent: '#5c85c4' },
  { id: 'monochrome', label: 'Monochrome', cover: '#161616', coverDeep: '#0b0b0b', accent: '#a3a3a3' },
];

// Logged-out visitors, and any account that hasn't picked a binding yet, see Monochrome.
export const DEFAULT_HOUSE = 'monochrome';
