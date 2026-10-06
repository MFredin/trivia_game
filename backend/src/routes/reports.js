import express from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireModerator } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimiter.js';
import { REPORT_REASONS, REPORT_DETAILS_MAX, REPORT_OUTCOMES } from '../lib/reportReasons.js';
import { HISTORY_DAYS, TIMED_ACTIONS, actionsFor, checkActionSet, suggestNext } from '../lib/moderation.js';
import { displayNameSql } from '../lib/displayName.js';
import { applyModeration } from '../services/moderation.js';
import { allowedActions, allowedDays, canActOn, checkRoleLimits, clampSuggestion, roleOf } from '../lib/roles.js';
import { snapshotConversation } from '../services/owlPost.js';
import { EVIDENCE_MESSAGES } from '../lib/owlPost.js';

const NOTE_MIN = 10;
const NOTE_MAX = 1000;

const router = express.Router();

router.use(requireAuth);

// Keyed by the reporter, not the IP: the limiter's buckets are one shared map, and the auth
// limiter already keys by IP, so an IP key here would count against someone's login attempts.
const reportRateLimit = rateLimit({ max: 10, windowMs: 60 * 60 * 1000, keyFn: (req) => `report:${req.userId}` });

router.post('/', reportRateLimit, async (req, res) => {
  const { username, reason, details, include_messages: includeMessages } = req.body ?? {};
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

  // A report made from inside a conversation carries the recent messages with it, copied now. That
  // is all a moderator ever sees of anyone's Owl Post: they do not browse inboxes, they read what
  // was reported. Only if the reporter asked, and only their own conversation with this player.
  const evidence =
    includeMessages === true ? await snapshotConversation(req.userId, target.id, EVIDENCE_MESSAGES) : null;

  // Reporting someone twice while the first is still open is a no-op that still answers 201: the
  // reporter's view is "sent", and nothing about the queue should be learnable from the retry.
  await pool.query(
    `INSERT INTO reports (reporter_id, reported_id, reason, details, evidence)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (reporter_id, reported_id) WHERE status = 'open' DO NOTHING`,
    [req.userId, target.id, reason, details?.trim() || null, evidence && evidence.length > 0 ? JSON.stringify(evidence) : null],
  );
  return res.status(201).json({ ok: true });
});

router.get('/', requireModerator, async (req, res) => {
  const open = req.query.status !== 'resolved';
  // Each report carries what a moderator needs to decide: the player's standing right now, how
  // many reports against them have already ended in action (within the history window), how many
  // suspensions they have had, and what else is waiting. The suggestion is computed from those.
  const { rows } = await pool.query(
    `SELECT r.id, r.reason, r.details, r.status, r.resolution, r.created_at, r.reviewed_at,
            reporter.username AS reporter_username,
            ${displayNameSql('reported')} AS reported_username,
            (reported.deleted_at IS NOT NULL) AS reported_deleted,
            reported.bio AS reported_bio, reported.is_admin AS reported_is_admin, reported.is_moderator AS reported_is_moderator,
            r.escalated_at, r.escalation_note, esc.username AS escalated_by_username,
            reported.suspended_until AS reported_suspended_until, reported.banned_at AS reported_banned_at,
            reported.must_rename AS reported_must_rename, reported.muted_until AS reported_muted_until,
            r.evidence,
            h.actioned, h.other_open, s.suspensions
     FROM reports r
     JOIN users reporter ON reporter.id = r.reporter_id
     JOIN users reported ON reported.id = r.reported_id
     LEFT JOIN users esc ON esc.id = r.escalated_by
     LEFT JOIN LATERAL (
       SELECT count(*) FILTER (WHERE r2.status = 'actioned' AND r2.reviewed_at > now() - make_interval(days => $1)) AS actioned,
              count(*) FILTER (WHERE r2.status = 'open' AND r2.id <> r.id) AS other_open
       FROM reports r2 WHERE r2.reported_id = r.reported_id
     ) h ON true
     LEFT JOIN LATERAL (
       SELECT count(*) AS suspensions FROM moderation_actions ma
       WHERE ma.user_id = r.reported_id AND ma.action = 'suspend' AND ma.created_at > now() - make_interval(days => $1)
     ) s ON true
     WHERE ${open ? `r.status = 'open'` : `r.status <> 'open'`}
     ORDER BY ${open ? '(r.escalated_at IS NULL), r.created_at ASC' : 'r.created_at DESC'}
     LIMIT 100`,
    [HISTORY_DAYS],
  );

  const reports = rows.map((r) => {
    const history = { actioned: Number(r.actioned), suspensions: Number(r.suspensions), other_open: Number(r.other_open) };
    const standing = {
      suspended_until: r.reported_suspended_until && r.reported_suspended_until > new Date() ? r.reported_suspended_until : null,
      banned: Boolean(r.reported_banned_at),
      must_rename: r.reported_must_rename,
      muted_until: r.reported_muted_until && r.reported_muted_until > new Date() ? r.reported_muted_until : null,
    };
    // Nothing can be done to a deleted account, to an admin, or (by a moderator) to another moderator; the
    // screen shows why rather than a button that would only be refused.
    const actionable = !r.reported_deleted && canActOn(req.role, roleOf({ is_admin: r.reported_is_admin, is_moderator: r.reported_is_moderator }));
    return {
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      resolution: r.resolution,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
      reporter_username: r.reporter_username,
      evidence: r.evidence ?? null,
      reported_username: r.reported_username,
      reported_bio: r.reported_bio,
      standing,
      history,
      actionable,
      reported_role: roleOf({ is_admin: r.reported_is_admin, is_moderator: r.reported_is_moderator }),
      // Sent up by a moderator who needs an admin: who, why, and when.
      escalated: r.escalated_at ? { at: r.escalated_at, by: r.escalated_by_username, note: r.escalation_note } : null,
      // What the viewer can apply: the suggestion is cut down to their role, with a cue to escalate if it had to be.
      suggestion: clampSuggestion(req.role, suggestNext(r.reason, { priorActioned: history.actioned, priorSuspensions: history.suspensions })),
      available_actions: actionsFor(r.reason).filter((a) => allowedActions(req.role).includes(a)),
    };
  });
  return res.json({ reports, suspension_days: allowedDays(req.role), viewer_role: req.role });
});

// Closing a report with no action against the player.
router.post('/:id/resolve', requireModerator, async (req, res) => {
  const { outcome } = req.body ?? {};
  if (!REPORT_OUTCOMES.includes(outcome)) return res.status(400).json({ error: 'invalid_outcome' });
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'report_not_found' });

  // A moderator closes only reports about players: one about another moderator or an admin is an admin's to judge.
  if (req.role !== 'admin') {
    const { rows } = await pool.query(
      `SELECT u.is_admin, u.is_moderator FROM reports r JOIN users u ON u.id = r.reported_id WHERE r.id = $1`,
      [Number(req.params.id)],
    );
    if (rows[0] && !canActOn(req.role, roleOf(rows[0]))) return res.status(403).json({ error: 'cannot_moderate_staff' });
  }

  const { rowCount } = await pool.query(
    `UPDATE reports SET status = $1, reviewed_by = $2, reviewed_at = now(), resolution = 'Dismissed'
     WHERE id = $3 AND status = 'open'`,
    [outcome, req.userId, Number(req.params.id)],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'report_not_found' });
  return res.status(204).end();
});

// Taking action against the reported player. `note` is written for the player — it is what they
// are told — so it is required, and the app never applies an action silently.
router.post('/:id/action', requireModerator, async (req, res) => {
  const { actions, days, note } = req.body ?? {};
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'report_not_found' });

  const problem = checkActionSet(actions, days);
  if (problem) return res.status(400).json({ error: problem });
  const text = typeof note === 'string' ? note.trim() : '';
  if (text.length < NOTE_MIN || text.length > NOTE_MAX) return res.status(400).json({ error: 'invalid_note' });
  // What this role may apply: a moderator cannot ban or suspend for longer than a week, and is told to escalate.
  if (checkRoleLimits(req.role, actions, days)) return res.status(403).json({ error: 'needs_admin' });

  const result = await applyModeration({
    adminId: req.userId,
    actorRole: req.role,
    reportId: Number(req.params.id),
    actions,
    days: actions.some((a) => TIMED_ACTIONS.includes(a)) ? days : null,
    note: text,
  });
  if (result.error) return res.status(result.error.status).json(result.error.body);
  return res.json({ resolution: result.resolution });
});

// A moderator sends a report up to the admins: it stays open, goes to the top of their queue, and says who sent
// it and why. Asking again changes nothing, so a double click is harmless.
router.post('/:id/escalate', requireModerator, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'report_not_found' });
  const note = req.body?.note;
  if (note != null && (typeof note !== 'string' || note.length > NOTE_MAX)) return res.status(400).json({ error: 'invalid_note' });

  const { rowCount } = await pool.query(
    `UPDATE reports SET escalated_at = COALESCE(escalated_at, now()), escalated_by = COALESCE(escalated_by, $2),
                        escalation_note = COALESCE(escalation_note, $3)
     WHERE id = $1 AND status = 'open'`,
    [Number(req.params.id), req.userId, typeof note === 'string' && note.trim() ? note.trim() : null],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'report_not_found' });
  return res.status(204).end();
});

export default router;
