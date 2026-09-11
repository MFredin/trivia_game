// ISO-8601 week key, e.g. "2026-W37". Weeks run Monday-Sunday and belong to whichever
// year contains that week's Thursday, per the ISO standard — avoids the "week 53 of last
// year" edge case that a naive day-of-year/7 calculation gets wrong.
export function currentLeaderboardWindow(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}
