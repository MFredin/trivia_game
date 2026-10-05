import { request } from './request.js';

export function reportPlayer({ username, reason, details, includeMessages }, token) {
  return request(
    '/reports',
    { method: 'POST', body: JSON.stringify({ username, reason, details, include_messages: includeMessages }) },
    token,
  );
}

export function getReports(status, token) {
  return request(`/reports?status=${status}`, {}, token);
}

// Closing a report with no action against the player.
export function dismissReport(id, token) {
  return request(`/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ outcome: 'dismissed' }) }, token);
}

// Taking action against the reported player. `note` is what they will be told.
export function takeAction(id, { actions, days, note }, token) {
  return request(`/reports/${id}/action`, { method: 'POST', body: JSON.stringify({ actions, days, note }) }, token);
}

// A moderator sends a report up to the admins, with a note on why.
export function escalateReport(id, note, token) {
  return request(`/reports/${id}/escalate`, { method: 'POST', body: JSON.stringify({ note }) }, token);
}
