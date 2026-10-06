// The seasons: themed question bundles that appear for a few weeks around an occasion (docs/seasonal-content-plan.md).
//
// Which season is active is a pure function of the date, so a new year needs no database edit and nothing to
// schedule — the same idea as the weekly featured challenge (lib/featuredChallenge.js), one rung sideways. Every
// function here takes the date as an argument, as currentLeaderboardWindow(date) does, so tests control the clock.
//
// Windows are evaluated in UTC, like the ISO week key, so the active season is the same for everyone. A window may
// therefore begin up to a day early or late in a player's own time; for a weeks-long window that is acceptable.
//
// A season is listed here only once the bank can field it: scripts/question-bank-audit.mjs fails if a season in this
// list has fewer than MIN_SEASON_POOL questions carrying its theme tag.

/** The fewest tagged questions a season may have. A bundle is replayable for weeks, so it needs a deeper pool than
 *  the ten the weekly challenge's guard asks for, or every attempt would feel like the same ten questions. */
export const MIN_SEASON_POOL = 60;

// start and end are [month, day] (month 1-12), both inclusive. A window whose end falls before its start crosses New Year.
export const SEASONS = [
  {
    key: 'halloween',
    theme: 'halloween',
    label: 'The Halloween Feast',
    blurb: 'Pumpkins, ghosts and a troll in the dungeon: questions for the feast.',
    start: [10, 17],
    end: [11, 2],
  },
  {
    key: 'yule',
    theme: 'yule',
    label: 'The Yule Feast',
    blurb: 'Snow on the towers and a very full Great Hall: questions for the Christmas holidays.',
    start: [12, 18],
    end: [1, 2],
  },
];

export const SEASON_THEMES = SEASONS.map((s) => s.theme);

const monthDay = (date) => (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
const asNumber = ([month, day]) => month * 100 + day;

function crossesNewYear(season) {
  return asNumber(season.end) < asNumber(season.start);
}

/** Whether `date` falls inside the season's window. */
export function inSeason(season, date = new Date()) {
  const today = monthDay(date);
  const start = asNumber(season.start);
  const end = asNumber(season.end);
  return crossesNewYear(season) ? today >= start || today <= end : today >= start && today <= end;
}

/** The season running on `date`, or null between seasons. Windows do not overlap, so there is at most one. */
export function activeSeason(date = new Date()) {
  return SEASONS.find((season) => inSeason(season, date)) ?? null;
}

/**
 * The year a season occurrence belongs to: the year its window STARTED in. A Yule run on 1 January 2027 is still the
 * Yule that began in December 2026, so a Boxing Day run and a New Year run are the same challenge.
 */
export function seasonYear(season, date = new Date()) {
  const year = date.getUTCFullYear();
  return crossesNewYear(season) && monthDay(date) <= asNumber(season.end) ? year - 1 : year;
}

/** The key one occurrence of a season is stored under, e.g. "halloween-2026". */
export function seasonKey(season, date = new Date()) {
  return `${season.key}-${seasonYear(season, date)}`;
}

/** Looks a season up by the key stored on a challenge ("halloween-2026"), or null. */
export function seasonFromKey(key) {
  const match = /^([a-z]+)-(\d{4})$/.exec(key ?? '');
  const season = match && SEASONS.find((s) => s.key === match[1]);
  return season ? { season, year: Number(match[2]) } : null;
}
