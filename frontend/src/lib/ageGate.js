// The registration age check, as the browser sees it. The server enforces the same rule
// (backend/src/lib/ageGate.js) and is the one that counts; this is so a player is told at once,
// before they have typed an email or a password.
export const MINIMUM_AGE = 13;

/** Whether someone born in this month is certainly old enough: the whole month they turned 13 in has passed. */
export function isOldEnough(month, year, now = new Date()) {
  const born = (year + MINIMUM_AGE) * 12 + month;
  const today = now.getFullYear() * 12 + (now.getMonth() + 1);
  return born < today;
}

// A device that has just been turned away is turned away again if it goes back and tries a different
// year, for a day. That is the whole of what is kept: a timestamp, in this browser, with no date of
// birth and nothing about who typed it. It is not a defence against someone determined to lie, and is
// not meant to be; it is the "do not make it a game to retry" half of a neutral age screen.
const FLAG_KEY = 'trivia_age_gate';
const FLAG_MS = 24 * 60 * 60 * 1000;

export function ageGateBlocked(now = Date.now()) {
  try {
    const at = Number(localStorage.getItem(FLAG_KEY));
    return Number.isFinite(at) && at > 0 && now - at < FLAG_MS;
  } catch {
    return false;
  }
}

export function markAgeGateBlocked(now = Date.now()) {
  try {
    localStorage.setItem(FLAG_KEY, String(now));
  } catch {
    // Storage can be unavailable (a private window). The gate still works for this visit.
  }
}
