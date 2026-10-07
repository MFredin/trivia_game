// The holiday overlays the app can draw, by the key the server sends (backend/src/lib/holidayOverlay.js, OVERLAYS). The label is what Settings
// calls each one, in the order an admin sees them. The keys must match the server's: it refuses an override it does not know, and the art for
// a key lives in holidays/<key>.js.
export const HOLIDAYS = {
  halloween: { label: 'Halloween' },
  thanksgiving: { label: 'Thanksgiving' },
  yule: { label: 'Yule' },
  newyear: { label: "New Year's" },
  easter: { label: 'Easter' },
  midsummer: { label: 'Midsummer' },
};

export const HOLIDAY_KEYS = Object.keys(HOLIDAYS);
