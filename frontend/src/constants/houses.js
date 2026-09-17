// Each house rebinds the same set of CSS custom properties (see styles/tokens.css) — the
// cover/accent/brass/ink hexes here are only for rendering fixed swatches (the Settings
// chips, the House Cup board, another player's profile), where a house has to render
// regardless of which theme is currently active. Not a second source of truth for the
// active theme's own colors — those always come from tokens.css.
//
// `ink` is the data-side twin of the --rubric token: this house's color that reads as TEXT
// on parchment. For three houses that is simply `brass`, but Hufflepuff's brass is gold
// (1.25:1 on parchment — invisible) and Monochrome's is a mid grey, so both take a darker
// tone here. Use `ink` for text and icons; `brass`/`accent`/`cover` for fills and swatches.
export const HOUSES = [
  { id: 'gryffindor', label: 'Gryffindor', cover: '#2b0607', coverDeep: '#190304', accent: '#ecb939', brass: '#ae0001', ink: '#ae0001' },
  { id: 'hufflepuff', label: 'Hufflepuff', cover: '#1c1712', coverDeep: '#100d0a', accent: '#726255', brass: '#ecb939', ink: '#372e29' },
  { id: 'slytherin', label: 'Slytherin', cover: '#0a1a13', coverDeep: '#050d0a', accent: '#aaaaaa', brass: '#2a623d', ink: '#2a623d' },
  { id: 'ravenclaw', label: 'Ravenclaw', cover: '#0a1330', coverDeep: '#060a1e', accent: '#b98d52', brass: '#2a4a8a', ink: '#2a4a8a' },
  { id: 'monochrome', label: 'Monochrome', cover: '#161616', coverDeep: '#0b0b0b', accent: '#e6e6e6', brass: '#5a5a5a', ink: '#1c1c1c' },
];

// Logged-out visitors, and any account that hasn't picked a binding yet, see Monochrome.
export const DEFAULT_HOUSE = 'monochrome';
