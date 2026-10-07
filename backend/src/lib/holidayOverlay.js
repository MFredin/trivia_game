// The holiday overlay: a decorated backdrop that appears around an occasion (docs/holiday-overlay.md).
//
// Which overlay is on is a pure function of the date, like the seasonal bundles (lib/seasons.js): a new year needs no database
// edit and nothing to schedule. The windows are NOT the bundles' windows. The Halloween bundle runs 17 October to 2 November
// because it is a set of questions people play for a while; the decoration goes up earlier, because it is atmosphere and it is
// what tells a player the season has started.
//
// An overlay is listed here only once the client can draw it: a key the frontend has no scene for would be a switch with nothing
// behind it. The keys are also what an admin may pick in Settings, and what `PATCH /account/holiday` accepts.
import { inSeason } from './seasons.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Fixed windows are [month, day], both inclusive, exactly as in SEASONS (a window whose end is before its start crosses New Year).
// Easter moves, so it is described by its distance from Easter Sunday instead.
//
// Together they cover most of the year without a gap between neighbours: Halloween ends the day before Thanksgiving starts, and
// Thanksgiving, Yule and New Year's follow one another to 2 January. Nothing overlaps (a test checks every day of five years,
// because Easter's position changes each year).
export const OVERLAYS = [
  { key: 'halloween', start: [10, 1], end: [11, 2] },
  { key: 'thanksgiving', start: [11, 3], end: [11, 30] },
  { key: 'yule', start: [12, 1], end: [12, 30] },
  { key: 'newyear', start: [12, 31], end: [1, 2] },
  { key: 'easter', easter: { before: 14, after: 1 } },
  { key: 'midsummer', start: [6, 15], end: [6, 24] },
];

export const OVERLAY_KEYS = OVERLAYS.map((overlay) => overlay.key);

/**
 * Easter Sunday of `year` in the Western (Gregorian) calendar, as a UTC date. The anonymous Gregorian algorithm (Meeus, Jones and
 * Butcher): exact for every year the Gregorian calendar covers. Orthodox Easter, which usually falls a week or more later, is not
 * what this is.
 */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Whether `overlay` is running on `date` (compared by UTC calendar day, like the seasons). */
export function overlayActive(overlay, date = new Date()) {
  if (!overlay.easter) return inSeason(overlay, date);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const easter = easterSunday(date.getUTCFullYear()).getTime();
  return today >= easter - overlay.easter.before * DAY_MS && today <= easter + overlay.easter.after * DAY_MS;
}

/** The overlay running on `date`, or null between holidays. Windows do not overlap, so there is at most one. */
export function activeOverlay(date = new Date()) {
  return OVERLAYS.find((overlay) => overlayActive(overlay, date))?.key ?? null;
}

/** An overlay named by key, or null: what a developer's ?force= or an admin's choice must be before it is believed. */
export function overlayByKey(key) {
  return OVERLAY_KEYS.includes(key) ? key : null;
}

/**
 * Reads a settings request: `{ overlay?: boolean, motion?: boolean, override?: string | null }`. Returns the fields to change, or
 * null when the request names none of them or gives one a value that is not valid. `override` is an overlay key (show that one,
 * whatever the date) or null (follow the calendar); only an admin may send it, which the route checks.
 *
 * Strict on purpose: "false" as a string is truthy to a careless update, and a setting that silently does the opposite of what was
 * sent is worse than a 400.
 */
export function parseHolidayPrefs(body) {
  if (!body || typeof body !== 'object') return null;
  const prefs = {};
  for (const field of ['overlay', 'motion']) {
    if (!(field in body)) continue;
    if (typeof body[field] !== 'boolean') return null;
    prefs[field] = body[field];
  }
  if ('override' in body) {
    if (body.override !== null && overlayByKey(body.override) === null) return null;
    prefs.override = body.override;
  }
  return Object.keys(prefs).length > 0 ? prefs : null;
}
