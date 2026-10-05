// What a moderator's action looks like to the person it was done to and to the staff (/api/moderation): notices to
// acknowledge, the action log, and lifting a suspension, mute or ban.
import { request } from './request.js';

export function getNotices(token) {
  return request('/moderation/notices', {}, token);
}

export function acknowledgeNotice(batchId, token) {
  return request(`/moderation/notices/${batchId}/acknowledge`, { method: 'POST' }, token);
}

export function getActionLog(token) {
  return request('/moderation/actions', {}, token);
}

export function liftAction(id, token) {
  return request(`/moderation/actions/${id}/lift`, { method: 'POST' }, token);
}
