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
