import { request } from './request.js';

export function register({ email, username, password, inviteCode }) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password, invite_code: inviteCode }),
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
