const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcMidnight(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getTime();
}

// Computes a Duolingo-style day streak from the distinct calendar days a player has a
// completed session on — no persisted counter, so there's nothing that can drift from what
// actually happened. `sortedDescDateStrings` are 'YYYY-MM-DD' UTC dates, most recent first
// (matching `SELECT DISTINCT DATE(completed_at)::text ... ORDER BY 1 DESC`).
export function computeStreaks(sortedDescDateStrings, today = new Date().toISOString().slice(0, 10)) {
  if (sortedDescDateStrings.length === 0) return { current: 0, longest: 0 };

  const times = sortedDescDateStrings.map(toUtcMidnight);
  const todayMs = toUtcMidnight(today);

  // "Current" only counts if the most recent play was today or yesterday — a gap of two or
  // more days means the streak has already lapsed, even though the historical run still
  // counts toward `longest`.
  let current = 0;
  if ((todayMs - times[0]) / MS_PER_DAY <= 1) {
    current = 1;
    for (let i = 1; i < times.length; i++) {
      if ((times[i - 1] - times[i]) / MS_PER_DAY === 1) current++;
      else break;
    }
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < times.length; i++) {
    if ((times[i - 1] - times[i]) / MS_PER_DAY === 1) {
      run++;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run, current);

  return { current, longest };
}
