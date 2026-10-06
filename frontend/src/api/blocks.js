// Blocking (/api/blocks): list the players you have blocked, block one, unblock one. A block hides each of you from the other.
import { request } from './request.js';

export function listBlocked(token) {
  return request('/blocks', {}, token);
}

export function blockPlayer(username, token) {
  return request('/blocks', { method: 'POST', body: JSON.stringify({ username }) }, token);
}

export function unblockPlayer(username, token) {
  return request(`/blocks/${encodeURIComponent(username)}`, { method: 'DELETE' }, token);
}
