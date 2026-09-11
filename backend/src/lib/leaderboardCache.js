const TTL_MS = 15_000;
const cache = new Map();

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

// Leaderboard rankings only change when a session completes, and completions are infrequent
// relative to reads — clearing the whole cache is simpler than tracking which segment changed.
export function invalidateLeaderboardCache() {
  cache.clear();
}
