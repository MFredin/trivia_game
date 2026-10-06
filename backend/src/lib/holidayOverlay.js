// The holiday overlay: a decorated backdrop that appears around an occasion (docs/holiday-overlay.md).
//
// It follows the same rule as the seasonal bundles (lib/seasons.js): which overlay is on is a pure function of the date,
// so a new year needs no database edit and nothing to schedule. The windows are NOT the bundles' windows, though. The
// Halloween bundle runs 17 October to 2 November because it is a set of questions people play for a while; the decoration
// goes up earlier, because it is atmosphere and it is what tells a player the season has started.
//
// A holiday is listed here only once the client can draw it: an overlay key the frontend has no scene for would be a
// switch with nothing behind it. Yule is the next one, and joins by adding an entry here and a scene there.
import { inSeason } from './seasons.js';

// start and end are [month, day], both inclusive, exactly as in SEASONS.
export const OVERLAYS = [{ key: 'halloween', start: [10, 1], end: [11, 2] }];

/** The overlay running on `date` (UTC, like the seasons), or null between holidays. */
export function activeOverlay(date = new Date()) {
  return OVERLAYS.find((overlay) => inSeason(overlay, date))?.key ?? null;
}

/** An overlay named by key, for a test or a developer to treat as active outside production. */
export function overlayByKey(key) {
  return OVERLAYS.find((overlay) => overlay.key === key)?.key ?? null;
}

/**
 * Reads a settings request: `{ overlay?: boolean, motion?: boolean }`. Returns the fields to change, or null when the
 * request names none of them or gives one a value that is not a real boolean. Strict on purpose: "false" as a string is
 * truthy to a careless update, and a setting that silently does the opposite of what was sent is worse than a 400.
 */
export function parseHolidayPrefs(body) {
  if (!body || typeof body !== 'object') return null;
  const prefs = {};
  for (const field of ['overlay', 'motion']) {
    if (!(field in body)) continue;
    if (typeof body[field] !== 'boolean') return null;
    prefs[field] = body[field];
  }
  return Object.keys(prefs).length > 0 ? prefs : null;
}
