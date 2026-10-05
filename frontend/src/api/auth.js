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

export function getInviteCode(token) {
  return request('/auth/invite-code', {}, token);
}
