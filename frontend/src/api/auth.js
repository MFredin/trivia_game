import { request } from './request.js';

export function register({ email, username, password, inviteCode, birth }) {
  // The birth month and year decide whether registration goes ahead and are not stored by the server.
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password, invite_code: inviteCode, birth_month: birth.month, birth_year: birth.year }),
  });
}

export function login({ email, password }) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function getMe(token) {
  return request('/auth/me', {}, token);
}

export function updateTheme(theme, token) {
  return request('/auth/theme', { method: 'PATCH', body: JSON.stringify({ theme }) }, token);
}

// A ticket for opening the WebSocket: good for one connection within half a minute, so the sign-in token never has to travel in a URL, where every proxy
// and log on the way would write it down. Answers { ticket }.
export function getSocketTicket(token) {
  return request('/auth/socket-ticket', { method: 'POST' }, token);
}

export function getInviteCode(token) {
  return request('/auth/invite-code', {}, token);
}
