import { request } from './request.js';

// The admin's view of the team: who is a moderator or admin, and making or unmaking a moderator.
export function getTeam(token) {
  return request('/admin/team', {}, token);
}

export function setRole({ username, role, giveTitle }, token) {
  return request('/admin/team', { method: 'POST', body: JSON.stringify({ username, role, give_title: giveTitle }) }, token);
}
