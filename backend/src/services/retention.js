import { pool } from '../db/pool.js';
import { CLOSED_REPORT_DAYS, MODERATION_ACTION_DAYS, REPORT_EVIDENCE_DAYS } from '../lib/retention.js';

// Housekeeping, the same shape as the Owl Post sweep: no job runner at hobby scale, just a periodic
// delete of whatever is past its period.
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Removes what has been kept long enough: copies of conversations first, then closed reports, then the
 * record of what was done to players. Open reports and sanctions in force are never touched, however old.
 * Returns what it removed, so a caller (a test, an operator) can see.
 */
export async function sweepModerationRecords() {
  const evidence = await pool.query(
    `UPDATE reports SET evidence = NULL
     WHERE evidence IS NOT NULL AND status <> 'open' AND reviewed_at < now() - make_interval(days => $1)`,
    [REPORT_EVIDENCE_DAYS],
  );

  // A sanction that outlives its report (a ban in force) keeps its place in the log, minus the link.
  await pool.query(
    `UPDATE moderation_actions SET report_id = NULL
     WHERE report_id IN (SELECT id FROM reports WHERE status <> 'open' AND reviewed_at < now() - make_interval(days => $1))`,
    [CLOSED_REPORT_DAYS],
  );
  const reports = await pool.query(
    `DELETE FROM reports WHERE status <> 'open' AND reviewed_at < now() - make_interval(days => $1)`,
    [CLOSED_REPORT_DAYS],
  );

  const actions = await pool.query(
    `DELETE FROM moderation_actions
     WHERE CASE
       WHEN action = 'ban' THEN lifted_at IS NOT NULL AND lifted_at < now() - make_interval(days => $1)
       WHEN action IN ('suspend', 'mute') THEN
         COALESCE(lifted_at, expires_at) IS NOT NULL
         AND (lifted_at IS NOT NULL OR expires_at < now())
         AND COALESCE(lifted_at, expires_at) < now() - make_interval(days => $1)
       ELSE created_at < now() - make_interval(days => $1)
     END`,
    [MODERATION_ACTION_DAYS],
  );

  return { evidenceCleared: evidence.rowCount, reportsDeleted: reports.rowCount, actionsDeleted: actions.rowCount };
}

setInterval(() => sweepModerationRecords().catch(() => {}), SWEEP_INTERVAL_MS).unref();
