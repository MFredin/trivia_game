import { pool } from '../db/pool.js';

// Housekeeping sweep, same shape as lib/rateLimiter.js's — no cron/job runner needed at
// hobby scale, just a periodic DELETE of anything old enough nobody's going to scroll to it.
const RETENTION_DAYS = 30;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  pool.query(`DELETE FROM activity_events WHERE created_at < now() - interval '${RETENTION_DAYS} days'`).catch(() => {});
}, SWEEP_INTERVAL_MS).unref();

export async function recordActivity(userId, type, payload) {
  await pool.query('INSERT INTO activity_events (user_id, type, payload) VALUES ($1, $2, $3)', [
    userId,
    type,
    JSON.stringify(payload),
  ]);
}
