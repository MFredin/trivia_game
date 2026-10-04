import { request } from './request.js';

export function updateAvatar(avatar, token) {
  return request('/account/avatar', { method: 'PATCH', body: JSON.stringify({ avatar }) }, token);
}
