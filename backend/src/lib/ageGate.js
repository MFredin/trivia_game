// The minimum age to hold an account, and the check that enforces it at registration. The Service is
// for players of this age and over (a deliberate choice: no under-13 accounts and no parent-approved mode). A birth date is asked for
// only to make this one decision: it is never stored, logged or returned, and nothing else from the
// request is read until it has passed.
export const MINIMUM_AGE = 13;

/**
 * A birth month and year, or `{ ok: false }` for anything that is not a real month of a plausible year.
 * Only month and year are asked for, which is enough and is less than a full date.
 */
export function checkBirthDate(input, now = new Date()) {
  if (input == null || typeof input !== 'object') return { ok: false };
  const { month, year } = input;
  if (!Number.isInteger(month) || !Number.isInteger(year)) return { ok: false };
  if (month < 1 || month > 12) return { ok: false };
  if (year < 1900 || year > now.getUTCFullYear()) return { ok: false };
  return { ok: true, month, year };
}

/**
 * Whether someone born in this month is certainly old enough. With only a month to go on, a player is
 * counted as old enough once the whole of the month they turned thirteen in has passed: it errs on the
 * side of keeping someone out for up to a month, never of letting them in early.
 */
export function isOldEnough({ month, year }, now = new Date()) {
  const born = (year + MINIMUM_AGE) * 12 + month;
  const today = now.getUTCFullYear() * 12 + (now.getUTCMonth() + 1);
  return born < today;
}
