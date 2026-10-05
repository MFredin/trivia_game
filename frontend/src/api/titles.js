import { request } from './request.js';

// The admin's view of system titles: who holds one, give one to a player, take one back.
export function getTitleHolders(token) {
  return request('/admin/titles', {}, token);
}

export function grantSystemTitle({ username, title }, token) {
  return request('/admin/titles', { method: 'POST', body: JSON.stringify({ username, title }) }, token);
}

export function revokeSystemTitle(username, title, token) {
  return request(`/admin/titles/${encodeURIComponent(username)}/${encodeURIComponent(title)}`, { method: 'DELETE' }, token);
}
