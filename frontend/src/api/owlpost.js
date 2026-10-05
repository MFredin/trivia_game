import { request } from './request.js';

export function getInbox(token) {
  return request('/owlpost/inbox', {}, token);
}

export function getUnread(token) {
  return request('/owlpost/unread', {}, token);
}

export function getThread(username, { before } = {}, token) {
  const query = before ? `?before=${before}` : '';
  return request(`/owlpost/with/${encodeURIComponent(username)}${query}`, {}, token);
}

export function sendOwl(username, body, token) {
  return request(`/owlpost/with/${encodeURIComponent(username)}`, { method: 'POST', body: JSON.stringify({ body }) }, token);
}

export function markThreadRead(username, token) {
  return request(`/owlpost/with/${encodeURIComponent(username)}/read`, { method: 'POST' }, token);
}

export function deleteOwl(id, token) {
  return request(`/owlpost/messages/${id}`, { method: 'DELETE' }, token);
}

export function setOwlPostMode(mode, token) {
  return request('/owlpost/settings', { method: 'PATCH', body: JSON.stringify({ mode }) }, token);
}
