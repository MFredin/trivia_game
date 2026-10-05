import { request } from './request.js';

export function getCustomization(token) {
  return request('/account/customization', {}, token);
}

// Only the fields that changed. The server validates the whole request before applying any of it.
export function saveProfile(fields, token) {
  return request('/account/profile', { method: 'PATCH', body: JSON.stringify(fields) }, token);
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

// Only accepted after a moderator has renamed the player.
export function renameUser(username, token) {
  return request('/account/username', { method: 'PATCH', body: JSON.stringify({ username }) }, token);
}
