// In-memory sliding-window limiter — same "hobby-scale, in-memory is fine" tradeoff already
// made for the leaderboard cache and presence registry. Resets on restart and doesn't share
// state across instances; fine at a single Railway instance, would need a real store (Redis)
// before ever running more than one.
const buckets = new Map(); // key -> timestamps (ms) of recent attempts, within the window

const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of buckets) {
    if (timestamps.every((t) => now - t > SWEEP_INTERVAL_MS)) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();

export function rateLimit({ max, windowMs, keyFn = (req) => req.ip }) {
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (timestamps.length >= max) {
      return res.status(429).json({ error: 'too_many_attempts' });
    }
    timestamps.push(now);
    buckets.set(key, timestamps);
    next();
  };
}
