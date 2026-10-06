import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { getSockets } from '../lib/presenceRegistry.js';
import { invalidateLeaderboardCache } from '../lib/leaderboardCache.js';
import { hashEmail } from '../lib/emailHash.js';
import { LOCKOUT_ACTIONS, TIMED_ACTIONS, describeResolution } from '../lib/moderation.js';
import { canActOn, roleOf } from '../lib/roles.js';

const fail = (error, status = 400) => ({ error: { status, body: { error } } });

/**
 * Apply one or more moderator actions to the player a report is about, in one transaction, and
 * close the report. Either everything happens or nothing does: a ban recorded but not applied, or
 * a warning with no row to show the player, is worse than neither.
 *
 * The target is read from the report, never from the request, so an action can only be taken
 * against the person who was actually reported. Admins and the acting admin themselves are out of
 * reach, and a moderator cannot act on another moderator: nobody in this app can be moderated by
 * someone they do not outrank, or by themselves. `actorRole` is who is acting; what that role may do
 * (a ban, a long suspension) is checked by the route before this is called.
 */
export async function applyModeration({ adminId, actorRole = 'admin', reportId, actions, days, note }) {
  const client = await pool.connect();
  let lockedOut = false;
  let targetId;
  try {
    await client.query('BEGIN');

    const { rows: reportRows } = await client.query(
      `SELECT id, reported_id FROM reports WHERE id = $1 AND status = 'open' FOR UPDATE`,
      [reportId],
    );
    if (reportRows.length === 0) {
      await client.query('ROLLBACK');
      return fail('report_not_found', 404);
    }
    targetId = reportRows[0].reported_id;

    const { rows: userRows } = await client.query(
      'SELECT id, email, is_admin, is_moderator, deleted_at FROM users WHERE id = $1 FOR UPDATE',
      [targetId],
    );
    const target = userRows[0];
    if (!target || target.deleted_at) {
      await client.query('ROLLBACK');
      return fail('user_not_found', 404);
    }
    if (target.is_admin || target.id === adminId) {
      await client.query('ROLLBACK');
      return fail('cannot_moderate_admin');
    }
    if (!canActOn(actorRole, roleOf(target))) {
      await client.query('ROLLBACK');
      return fail('cannot_moderate_staff');
    }

    const batchId = crypto.randomUUID();
    for (const action of actions) {
      let expiresAt = null;
      let emailHash = null;

      if (action === 'force_rename') {
        await client.query('UPDATE users SET username = $2, must_rename = true WHERE id = $1', [
          targetId,
          `player-${targetId}-${crypto.randomBytes(2).toString('hex')}`,
        ]);
      } else if (action === 'clear_bio') {
        await client.query('UPDATE users SET bio = NULL WHERE id = $1', [targetId]);
      } else if (action === 'reset_avatar') {
        await client.query(`UPDATE users SET avatar = NULL, avatar_style = '{}' WHERE id = $1`, [targetId]);
      } else if (action === 'remove_scores') {
        // The leaderboards already leave out a run held for review (routes/leaderboard.js), so
        // removing scores is holding every completed run — reversible, and nothing is deleted.
        await client.query(
          `UPDATE game_sessions SET flagged_for_review = true, flag_reason = 'removed by a moderator'
           WHERE user_id = $1 AND status = 'completed' AND flagged_for_review = false`,
          [targetId],
        );
      } else if (action === 'mute') {
        // Stops sending Owl Post, nothing else: the player can still play, and still read.
        const { rows } = await client.query(
          `UPDATE users SET muted_until = now() + make_interval(days => $2) WHERE id = $1 RETURNING muted_until`,
          [targetId, days],
        );
        expiresAt = rows[0].muted_until;
      } else if (action === 'suspend') {
        const { rows } = await client.query(
          `UPDATE users SET suspended_until = now() + make_interval(days => $2) WHERE id = $1 RETURNING suspended_until`,
          [targetId, days],
        );
        expiresAt = rows[0].suspended_until;
      } else if (action === 'ban') {
        await client.query('UPDATE users SET banned_at = now() WHERE id = $1', [targetId]);
        if (target.email) {
          emailHash = hashEmail(target.email);
          await client.query('INSERT INTO banned_emails (email_hash) VALUES ($1) ON CONFLICT DO NOTHING', [emailHash]);
        }
      }

      const lockout = LOCKOUT_ACTIONS.includes(action);
      lockedOut ||= lockout;
      await client.query(
        `INSERT INTO moderation_actions
           (batch_id, user_id, report_id, admin_id, action, note, days, expires_at, email_hash, acknowledged_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [batchId, targetId, reportId, adminId, action, note, TIMED_ACTIONS.includes(action) ? days : null, expiresAt, emailHash, lockout ? new Date() : null],
      );
    }

    const resolution = describeResolution(actions, days);
    await client.query(
      `UPDATE reports SET status = 'actioned', reviewed_by = $2, reviewed_at = now(), resolution = $3 WHERE id = $1`,
      [reportId, adminId, resolution],
    );

    await client.query('COMMIT');

    // After the commit, so nothing is closed or invalidated for an action that then rolls back.
    if (actions.includes('remove_scores')) invalidateLeaderboardCache();
    if (lockedOut) for (const ws of getSockets(targetId)) ws.close();
    return { batchId, resolution };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Lift a suspension or a ban a moderator applied — for a mistake, or an appeal that succeeded. The
 * player's state is recomputed from the actions that remain, so lifting one of two overlapping
 * suspensions leaves the other in force.
 */
export async function liftAction({ adminId, actorRole = 'admin', actionId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, user_id, action, email_hash, admin_id FROM moderation_actions
       WHERE id = $1 AND action IN ('suspend', 'ban', 'mute') AND lifted_at IS NULL FOR UPDATE`,
      [actionId],
    );
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return fail('action_not_found', 404);
    }

    // A moderator can take back what they did themselves, short of a ban; anything else is an admin's.
    if (actorRole !== 'admin' && (row.action === 'ban' || row.admin_id !== adminId)) {
      await client.query('ROLLBACK');
      return fail('needs_admin', 403);
    }

    await client.query('UPDATE moderation_actions SET lifted_at = now(), lifted_by = $2 WHERE id = $1', [actionId, adminId]);

    await client.query(
      `UPDATE users SET
         suspended_until = (SELECT max(expires_at) FROM moderation_actions
                            WHERE user_id = $1 AND action = 'suspend' AND lifted_at IS NULL AND expires_at > now()),
         muted_until = (SELECT max(expires_at) FROM moderation_actions
                        WHERE user_id = $1 AND action = 'mute' AND lifted_at IS NULL AND expires_at > now()),
         banned_at = CASE WHEN EXISTS (SELECT 1 FROM moderation_actions
                                       WHERE user_id = $1 AND action = 'ban' AND lifted_at IS NULL)
                          THEN banned_at ELSE NULL END
       WHERE id = $1`,
      [row.user_id],
    );
    if (row.action === 'ban' && row.email_hash) {
      // Only if no other ban on record still stands behind the same address.
      await client.query(
        `DELETE FROM banned_emails WHERE email_hash = $1
         AND NOT EXISTS (SELECT 1 FROM moderation_actions WHERE email_hash = $1 AND action = 'ban' AND lifted_at IS NULL)`,
        [row.email_hash],
      );
    }
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
