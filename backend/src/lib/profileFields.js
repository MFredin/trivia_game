// The structured things a player can say about themselves without typing anything: the other half
// of profile customisation beside the free-text bio (lib/bioFilter.js). Picked from lists, so
// there is nothing here to moderate.
export const FAVORITE_BOOKS = [
  "Philosopher's Stone",
  'Chamber of Secrets',
  'Prisoner of Azkaban',
  'Goblet of Fire',
  'Order of the Phoenix',
  'Half-Blood Prince',
  'Deathly Hallows',
];

export const MAX_PINNED_ACHIEVEMENTS = 3;

export function isFavoriteBook(value) {
  return FAVORITE_BOOKS.includes(value);
}

/** A list of at most three distinct ids, or null if it is not one. */
export function normalizePinned(value) {
  if (!Array.isArray(value) || value.length > MAX_PINNED_ACHIEVEMENTS) return null;
  if (!value.every((id) => typeof id === 'string')) return null;
  if (new Set(value).size !== value.length) return null;
  return value;
}
