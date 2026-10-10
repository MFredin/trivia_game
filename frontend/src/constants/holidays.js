// The holiday overlays the app can draw, by the key the server sends (backend/src/lib/holidayOverlay.js, OVERLAYS). The label is what Settings
// calls each one, in the order an admin sees them. The keys must match the server's: it refuses an override it does not know, and the art for
// a key lives in holidays/<key>.js. `visitor` is the creature that crosses the page while the holiday is on, which a player can catch once for an
// achievement (features/holiday/useHolidayVisitor.js; the reward is the server's, CATCHABLE in backend/src/lib/holidayOverlay.js): `symbol` is its
// drawing in the holiday's defs, `lane` where it goes (the sky or the ground), `top` or `bottom` the band of the screen it uses as percentages,
// `dur` how many seconds it takes to cross, and `width` how wide it is drawn. `perchSymbol` and `perchViewBox`, if it has them, are how it is drawn standing still. `bound` is true once a holiday has its own colour binding (styles/tokens.css), which is what lets the room's
// labels say "Dressed for Halloween" instead of naming the player's house: while a holiday is bound, the house colours rest.
export const HOLIDAYS = {
  halloween: {
    label: 'Halloween',
    bound: true,
    visitor: { kind: 'bat', symbol: 'hw-bat', viewBox: '0 0 60 30', lane: 'sky', top: [16, 40], dur: [9, 4], width: [52, 14], label: 'A bat is flying past. Catch it.', perch: 'A bat is hanging from the oak. Catch it.' },
  },
  thanksgiving: {
    label: 'Thanksgiving',
    bound: true,
    visitor: { kind: 'turkey', symbol: 'th-turkey', viewBox: '0 0 80 76', lane: 'ground', bottom: [1, 3], dur: [17, 6], width: [64, 10], label: 'A wild turkey is strolling past. Catch it.', perch: 'A wild turkey is standing among the pumpkins. Catch it.' },
  },
  yule: {
    label: 'Yule',
    bound: true,
    visitor: { kind: 'owl', symbol: 'yu-owl', viewBox: '0 0 90 60', perchSymbol: 'yu-owl-sit', perchViewBox: '0 0 40 56', lane: 'sky', top: [14, 36], dur: [11, 4], width: [78, 14], label: 'A snowy owl is flying past with a parcel. Catch it.', perch: 'A snowy owl is sitting on the lantern post. Catch it.' },
  },
  newyear: {
    label: "New Year's",
    bound: true,
    visitor: { kind: 'cork', symbol: 'ny-cork', viewBox: '0 0 80 40', perchSymbol: 'ny-bottle', perchViewBox: '0 0 30 70', lane: 'sky', top: [18, 34], dur: [8, 3], width: [54, 10], label: 'A champagne cork is flying past. Catch it.', perch: 'A champagne bottle is about to pop on the terrace. Catch the cork.' },
  },
  easter: {
    label: 'Easter',
    bound: true,
    visitor: { kind: 'rabbit', symbol: 'ea-rabbit', viewBox: '0 0 80 64', lane: 'ground', bottom: [1, 3], dur: [16, 5], width: [60, 10], label: 'A rabbit is hopping past with an egg. Catch it.', perch: 'A rabbit is sitting by the basket with an egg. Catch it.' },
  },
  midsummer: {
    label: 'Midsummer',
    bound: true,
    visitor: { kind: 'firefly', symbol: 'ms-firefly', viewBox: '0 0 50 40', lane: 'sky', top: [28, 34], dur: [12, 5], width: [44, 10], label: 'A firefly is drifting past. Catch it.', perch: 'A firefly is resting on a flower. Catch it.' },
  },
};

export const HOLIDAY_KEYS = Object.keys(HOLIDAYS);
