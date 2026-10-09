// The holiday overlays the app can draw, by the key the server sends (backend/src/lib/holidayOverlay.js, OVERLAYS). The label is what Settings
// calls each one, in the order an admin sees them. The keys must match the server's: it refuses an override it does not know, and the art for
// a key lives in holidays/<key>.js. `bound` is true once a holiday has its own colour binding (styles/tokens.css), which is what lets the room's
// labels say "Dressed for Halloween" instead of naming the player's house: while a holiday is bound, the house colours rest.
export const HOLIDAYS = {
  halloween: { label: 'Halloween', bound: true },
  thanksgiving: { label: 'Thanksgiving' },
  yule: { label: 'Yule' },
  newyear: { label: "New Year's" },
  easter: { label: 'Easter' },
  midsummer: { label: 'Midsummer' },
};

export const HOLIDAY_KEYS = Object.keys(HOLIDAYS);
