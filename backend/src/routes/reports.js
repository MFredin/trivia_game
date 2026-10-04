import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimiter.js';
import { REPORT_REASONS, REPORT_DETAILS_MAX, REPORT_OUTCOMES } from '../lib/reportReasons.js';

const router = express.Router();

router.use(requireAuth);

// Keyed by the reporter, not the IP: the limiter's buckets are one shared map, and the auth
// limiter already keys by IP, so an IP key here would count against someone's login attempts.
const reportRateLimit = rateLimit({ max: 10, windowMs: 60 * 60 * 1000, keyFn: (req) => `report:${req.userId}` });

router.post('/', reportRateLimit, async (req, res) => {
  const { username, reason, details } = req.body ?? {};
  if (typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'invalid_username' });
  }
  if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ error: 'invalid_reason' });
  if (details != null && (typeof details !== 'string' || details.length > REPORT_DETAILS_MAX)) {
    return res.status(400).json({ error: 'invalid_details' });
  }

  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL', [username.trim()]);
  const target = rows[0];
  if (!target) return res.status(404).json({ error: 'user_not_found' });
  if (target.id === req.userId) return res.status(400).json({ error: 'cannot_report_yourself' });

  // Reporting someone twice while the first is still open is a no-op that still answers 201: the
  // reporter's view is "sent", and nothing about the queue should be learnable from the retry.
  await pool.query(
    `INSERT INTO reports (reporter_id, reported_id, reason, details)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (reporter_id, reported_id) WHERE status = 'open' DO NOTHING`,
    [req.userId, target.id, reason, details?.trim() || null],
  );
  return res.status(201).json({ ok: true });
});

router.get('/', requireAdmin, async (req, res) => {
  const status = req.query.status === 'resolved' ? 'resolved' : 'open';
  const { rows } = await pool.query(
    `SELECT r.id, r.reason, r.details, r.status, r.created_at, r.reviewed_at,
            reporter.username AS reporter_username, reported.username AS reported_username
     FROM reports r
     JOIN users reporter ON reporter.id = r.reporter_id
     JOIN users reported ON reported.id = r.reported_id
     WHERE ${status === 'open' ? `r.status = 'open'` : `r.status <> 'open'`}
     ORDER BY r.created_at ${status === 'open' ? 'ASC' : 'DESC'}
     LIMIT 100`,
  );
  return res.json({ reports: rows });
});

router.post('/:id/resolve', requireAdmin, async (req, res) => {
  const { outcome } = req.body ?? {};
  if (!REPORT_OUTCOMES.includes(outcome)) return res.status(400).json({ error: 'invalid_outcome' });
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'report_not_found' });

  const { rowCount } = await pool.query(
    `UPDATE reports SET status = $1, reviewed_by = $2, reviewed_at = now()
     WHERE id = $3 AND status = 'open'`,
    [outcome, req.userId, Number(req.params.id)],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'report_not_found' });
  return res.status(204).end();
});

export default router;
