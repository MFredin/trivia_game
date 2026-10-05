// Who may do what about a report. Three levels, and the difference between the two staff levels is
// deliberately small and easy to state:
//
//   player     — nothing here.
//   moderator  — reviews reports and acts on them: warn, rename, clear a bio, reset an avatar, hold scores,
//                mute, suspend, for up to a week. Cannot ban, cannot suspend or mute for longer, cannot act
//                on another moderator or an admin. What would take more is escalated to an admin.
//   admin      — everything, including bans, 30-day suspensions, the question queue, titles, the team, and
//                lifting any sanction. Cannot be moderated.
//
// The role is not in the token (lib/authTokens.js): it is read fresh from the account on each request.
import { MODERATION_ACTIONS, SUSPENSION_DAYS } from './moderation.js';

export const ROLES = ['player', 'moderator', 'admin'];

// The longest a moderator may suspend or mute for.
export const MODERATOR_MAX_DAYS = 7;

export function roleOf(row) {
  if (row?.is_admin) return 'admin';
  if (row?.is_moderator) return 'moderator';
  return 'player';
}

export const canReviewReports = (role) => role === 'moderator' || role === 'admin';

export function allowedActions(role) {
  if (role === 'admin') return [...MODERATION_ACTIONS];
  if (role === 'moderator') return MODERATION_ACTIONS.filter((a) => a !== 'ban');
  return [];
}

export function allowedDays(role) {
  if (role === 'admin') return [...SUSPENSION_DAYS];
  if (role === 'moderator') return SUSPENSION_DAYS.filter((d) => d <= MODERATOR_MAX_DAYS);
  return [];
}

/** Whether someone in `actor`'s role may take action against someone in `target`'s. */
export function canActOn(actor, target) {
  if (actor === 'admin') return target !== 'admin';
  if (actor === 'moderator') return target === 'player';
  return false;
}

/** `'needs_admin'` if these actions (and days) are beyond the role; null if the role may apply them. */
export function checkRoleLimits(role, actions, days) {
  const allowed = allowedActions(role);
  if (!actions.every((a) => allowed.includes(a))) return 'needs_admin';
  const timed = actions.some((a) => a === 'suspend' || a === 'mute');
  if (timed && !allowedDays(role).includes(days)) return 'needs_admin';
  return null;
}

/**
 * A suggestion cut down to what the role can apply. If anything had to be cut — a ban, or a longer
 * suspension — `needs_admin` is true, which is the screen's cue to offer escalating the report.
 */
export function clampSuggestion(role, suggestion) {
  if (role === 'admin') return { ...suggestion, needs_admin: false };
  const maxDays = Math.max(...allowedDays(role));
  let needsAdmin = false;
  let actions = suggestion.actions;
  let days = suggestion.days;
  if (actions.includes('ban')) {
    actions = [...actions.filter((a) => a !== 'ban'), 'suspend'];
    days = maxDays;
    needsAdmin = true;
  }
  if (actions.some((a) => a === 'suspend' || a === 'mute') && days > maxDays) {
    days = maxDays;
    needsAdmin = true;
  }
  return { actions, days, needs_admin: needsAdmin };
}
