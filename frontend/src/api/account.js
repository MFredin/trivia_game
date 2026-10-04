import { request } from './request.js';

export function updateAvatar(avatar, token) {
  return request('/account/avatar', { method: 'PATCH', body: JSON.stringify({ avatar }) }, token);
}

export function updateFriendsVisibility(friendsVisibility, token) {
  return request('/account/privacy', { method: 'PATCH', body: JSON.stringify({ friends_visibility: friendsVisibility }) }, token);
}
