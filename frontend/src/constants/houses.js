// Each house rebinds the same set of CSS custom properties (see styles/tokens.css) — the
// cover/accent hexes here are only for rendering the swatch chips on the Settings screen,
// not a second source of truth for the actual theme colors.
export const HOUSES = [
  { id: 'gryffindor', label: 'Gryffindor', cover: '#2b0607', coverDeep: '#190304', accent: '#ecb939' },
  { id: 'hufflepuff', label: 'Hufflepuff', cover: '#1c1712', coverDeep: '#100d0a', accent: '#726255' },
  { id: 'slytherin', label: 'Slytherin', cover: '#0a1a13', coverDeep: '#050d0a', accent: '#aaaaaa' },
  { id: 'ravenclaw', label: 'Ravenclaw', cover: '#0a1330', coverDeep: '#060a1e', accent: '#b98d52' },
  { id: 'monochrome', label: 'Monochrome', cover: '#161616', coverDeep: '#0b0b0b', accent: '#e6e6e6' },
];

// Logged-out visitors, and any account that hasn't picked a binding yet, see Monochrome.
export const DEFAULT_HOUSE = 'monochrome';
