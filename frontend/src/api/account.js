import { request } from './request.js';

export function updateAvatar(avatar, token) {
  return request('/account/avatar', { method: 'PATCH', body: JSON.stringify({ avatar }) }, token);
}

export function updateFriendsVisibility(friendsVisibility, token) {
  return request('/account/privacy', { method: 'PATCH', body: JSON.stringify({ friends_visibility: friendsVisibility }) }, token);
}

export function changePassword({ currentPassword, newPassword }, token) {
  return request(
    '/account/password',
    { method: 'PATCH', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) },
    token,
  );
}

export function deleteAccount(password, token) {
  return request('/account', { method: 'DELETE', body: JSON.stringify({ password }) }, token);
}
